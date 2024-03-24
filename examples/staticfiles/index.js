import {Router} from 'mg-bun-router';
let router = new Router();

router.get('/user/:id', (req) => {
  return Response.json({user: req.params.id});
});

// all other requests will try to fetch a file matching the path
//  or return an unrecognised request error

router.static('/home/ubuntu/www');

Bun.serve({
  port: 3000,
  async fetch(Req) {
    return await router.useRoutes(Req);
  }
});

// start using:   bun index.js