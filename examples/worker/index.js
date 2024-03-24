import {Router} from 'mg-bun-router';
let router = new Router({
  logging: true, // display QOper8 activity (default: false)
  poolSize: 4,   // use up to a max of 4 child processes (default: 2)
  workerHandlersByRoute: [
    {
      method: 'get',
      url: '/worker/:id',
      handlerPath: 'showId.js'
    }
  ]
});

router.get('/local/:id', (req) => {
  return Response.json({handled_locally: req.params.id});
});

router.invalid();

Bun.serve({
  port: 3000,
  async fetch(Req) {
    return await router.useRoutes(Req);
  }
});

// start using:   bun index.js