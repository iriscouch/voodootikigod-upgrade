#!/usr/bin/env node
//
// Fix the voodootikigod rewrites

var txn = require('txn')
var util = require('util')
var request = require('request')
var probe_couchdb = require('probe_couchdb').defaults({'do_users':false})

var FIX_DOMAINS = [ 'couchdb.minutewith.com', 'mobile.minutewith.com', 'node.minutewith.com', 'riak.minutewith.com'
                  , 'www.aminutewithbrendan.com', 'staging.aminutewithbrendan.com' ]
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
  var vhosts = []
  Object.keys(config.vhosts).forEach(function(domain) {
    if(!~ FIX_DOMAINS.indexOf(domain))
      return console.log('Skipping vhost: %s', domain)
    else
      vhosts.push({'domain':domain, 'target':config.vhosts[domain]})
  })

  fix_domain()
  function fix_domain() {
    var vhost = vhosts.shift()
    if(!vhost)
      return console.log('Fixed all domains')

    console.log('Should fix %s %s', vhost.domain, vhost.target)
    fix_domain()
  }
}
