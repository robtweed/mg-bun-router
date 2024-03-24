import {Router} from 'mg-bun-router';
let router = new Router({
  logging: true, // display QOper8 activity (default: false)
  workerHandlersByRoute: [
    {
      method: 'post',
      url: '/user',
      handlerPath: 'createUser.js'
    },
    {
      method: 'get',
      url: '/user/:id',
      handlerPath: 'getUser.js'
    }
  ],
  // open connection to YottaDB (your configuration may differ)
  mgdbx: {
    open: {
      type: "YottaDB",
      path: "/usr/local/lib/yottadb/r138",
      env_vars: {
        ydb_dir: '/opt/yottadb',
        ydb_gbldir: '/opt/yottadb/yottadb.gld',
        ydb_routines: '/opt/mgateway/m /usr/local/lib/yottadb/r138/libyottadbutil.so',
        ydb_ci: '/usr/local/lib/yottadb/r138/zmgsi.ci'
      }
    }
  }
});

router.invalid();

Bun.serve({
  port: 3000,
  async fetch(Req) {
    return await router.useRoutes(Req);
  }
});

/*

 start using:   bun index.js

 Create a user (response returns allocated id)

   curl -v -X POST -H "Content-Type: application/json" -d "{\"firstName\": \"Rob\", \"lastName\": \"Tweed\"}" http://localhost:3000/user


 Get a user by id:

   curl -v http://localhost:3000/user/1  

*/

