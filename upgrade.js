#!/usr/bin/env node
//
// Fix the voodootikigod rewrites

var txn = require('txn')
var util = require('util')
var request = require('request')

var url = process.env.iriscouch_url || process.argv[2]

if(!url)
  return console.error('Usage: upgrade.js https://admin:secret@voodootikigod.iriscouch.com:6984')

url = url.replace(/\/+$/, '')
console.log('Checking: %s', url)
request({'url':url+'/_session', 'json':true}, function(er, res) {
  if(er)
    throw er

  var roles = res.body.userCtx.roles
  if(!~ roles.indexOf('_admin'))
    return console.error('Must be an admin on this couch')
  else
    console.log('Good couch, fixing...')

  console.log('TODO')
})
