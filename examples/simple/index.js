import {Router} from 'mg-bun-router';
let router = new Router();

router.get('/*', (req) => {
  return Response.json({hello: 'world'});
});

Bun.serve({
  port: 3000,
  async fetch(Req) {
    return await router.useRoutes(Req);
  }
});

// start using:   bun index.js