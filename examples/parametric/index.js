import {Router} from 'mg-bun-router';
let router = new Router();

router.get('/user/:id', (req) => {
  return Response.json({user: req.params.id});
});

router.invalid();

Bun.serve({
  port: 3000,
  async fetch(Req) {
    return await router.useRoutes(Req);
  }
});

// start using:   bun index.js