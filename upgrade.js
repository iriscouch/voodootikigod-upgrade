#!/usr/bin/env node
//
// Fix the voodootikigod rewrites

var txn = require('txn')
var util = require('util')
var request = require('request')
var probe_couchdb = require('probe_couchdb').defaults({'do_users':false})

var FIX_DOMAINS = [ 'couchdb.minutewith.com', 'mobile.minutewith.com', 'node.minutewith.com', 'riak.minutewith.com'
                  , 'www.aminutewithbrendan.com' ]
var url = process.env.iriscouch_url || process.argv[2]

if(!url)
  return console.error('Usage: upgrade.js https://admin:secret@voodootikigod.iriscouch.com:6984')

console.log('Checking: %s', url)
var couch = new probe_couchdb.CouchDB(url)
couch.start()

couch.on('error', function(er) {
  console.error('Error: %s', er.message)
  throw er
})

couch.on('session', function(session) {
  var roles = session.userCtx.roles
  if(!~ roles.indexOf('_admin'))
    return console.error('Must be an admin on this couch')

  console.log('Good couch, fixing...')
  couch.known('config', fix_vhosts)
})

function fix_vhosts(config) {
  var couch = this

  var vhosts = []
  Object.keys(config.vhosts).forEach(function(domain) {
    if(!~ FIX_DOMAINS.indexOf(domain))
      return console.log('Skipping vhost: %s', domain)

    var target = config.vhosts[domain]
      , match = target.match(/^(.*)\/_rewrite$/)

    if(!match)
      throw new Error('Unknown vhost target: %s', target)

    vhosts.push({'domain':domain, 'ddoc':match[1]})
  })

  fix_domain()
  function fix_domain() {
    var vhost = vhosts.shift()
    if(!vhost)
      return console.log('Fixed all domains')

    var url = couch.url + '/' + vhost.ddoc
    console.log('Fixing %s in %s', vhost.domain, vhost.ddoc)
    return txn({'url':url}, fix_ddoc, ddoc_fixed)

    function fix_ddoc(ddoc, to_txn) {
      if(!ddoc.rewrites || !Array.isArray(ddoc.rewrites))
        return to_txn(new Error('Bad rewrites in ddoc: ' + vhost.ddoc))

      //console.log('Rewrite rules for %s:\n%s', vhost.ddoc, util.inspect(ddoc.rewrites))

      var rewrites = []
        , blank_rewrite = null
        , wildcard_rewrite = null

      ddoc.rewrites.forEach(function(rewrite) {
        if(rewrite.from == '*')
          return console.log('Ignore wildcard rewrite: %j', rewrite)

        if(rewrite.from == '') {
          blank_rewrite = rewrite

          wildcard_rewrite = JSON.parse(JSON.stringify(blank_rewrite))
          wildcard_rewrite.from = '*'
        }

        if(rewrite.query)
          Object.keys(rewrite.query).forEach(function(key) {
            var val = rewrite.query[key]
            if(typeof val == 'boolean' || typeof val == 'number')
              rewrite.query[key] = "" + val
          })

        rewrites.push(rewrite)
      })

      if(!blank_rewrite)
        return to_txn(new Error('Cannot find empty string rewrite, "": ' + vhost.ddoc))
      if(!wildcard_rewrite)
        return to_txn(new Error('Failed to build wildcard rewrite, "*": ' + vhost.ddoc))

      rewrites.push(wildcard_rewrite)

      ddoc.rewrites = rewrites
      //console.log('New rewrite rules for %s:\n%s', vhost.ddoc, util.inspect(ddoc.rewrites))

      return to_txn()
    }

    function ddoc_fixed(er) {
      if(er)
        throw er

      console.log('Fixed: %s', vhost.domain)
      fix_domain() // Do the next one (serially).
    }
  }
}
