const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrprokdigital = onRequest({"region":"asia-northeast3","memory":"512MiB"}, (req, res) => server.then(it => it.handle(req, res)));
  