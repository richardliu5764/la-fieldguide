self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil((async function(){
  var ks=await caches.keys(); for (var k of ks) await caches.delete(k);
  await self.registration.unregister();
  var cs=await self.clients.matchAll(); cs.forEach(function(c){c.navigate(c.url)});
})())});
