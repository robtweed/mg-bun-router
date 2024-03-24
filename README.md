# mg-bun-router: Router for Bun.serve
 
Rob Tweed <rtweed@mgateway.com>  
22 March 2024, MGateway Ltd [https://www.mgateway.com](https://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)


## Background

*mg-bun-router* is an Express-like router for Bun.js' built-in, very high-performance HTTP Server: *Bun.serve*.

The main routing logic makes use of the popular and extremely fast 
[*find-my-way*](https://github.com/delvedor/find-my-way) Router package, but adapts it for use with *Bun.serve*.

*mg-bun-router* allows you to define simple and parametric routes, and includes a simple static file router.

Furthermore, *mg-bun-router* also integrates the 
[*QOper8-cp*](https://github.com/robtweed/qoper8-cp) package with *Bun.serve*, to allow handling of incoming
requests by a pool of Child Processes, from within which access to the YottaDB or IRIS Global Storage databases can be enbaled.

When using routes that use *QOper8*, incoming requests are placed in a queue, from where they are dispatched to an available
Worker and handled by a module of your choice.

This queue-based design creates a highly-scalable architecture for handling a large amount of messages, particularly if some require significant CPU resources, since the load imposed by handling the messages is off-loaded to a 
WebWorker, Worker Thread or Child Process.  An interesting aspect of the *QOper8* Modules is that each Worker only handles a single message at a time, meaning that within the Worker, concurrency is not an issue.  *mg-bun-router* Handlers can therefore safely use synchronous APIs if required, and hence the synchronous *mg-dbx-napi* interface APIs can be safely used to access YottaDB and IRIS in a production environment.

The *QOper8* modules themselves are extremely fast: benchmarks on a standard M1 Mac Mini have shown that *QOper8*'s
throughput can exceed 150,000 messages/second when used with a pool of 8 Child Processes Workers.


## API Handling

*mg-bun-router* allows a mix of

- API routes that are handled by *Bun.serve* in its main thread as normal
- API routes that are handled within a Child Process
- requests for static files


## Installing *mg-bun-router*

        bun install mg-bun-router

Installing *mg-bun-router* will also install the following packages as dependencies:

  - qoper8-cp
  - find-my-way


## Configuring and Running Bun.serve with *mg-bun-router*


- First, import the *mg-bun-router* package:

        import {Router} from 'mg-bun-router';

- Next, you create an instance of the *Router* Class, eg:

        let router = new Router();

- Now you can define any routes you want.  Let's start with:

        router.get('/*', (req) => {
          return Response.json({hello: 'world'});
        });

  Each route must return a valid *Response* object.  You can make use of the standard *Response* APIs provided by Bun.

- Finally start up *Bun.serve* and instruct it to use your route(s), eg:

        Bun.serve({
          port: 3000,
          async fetch(req) {
            return await router.useRoutes(req);
          }
        });


- Putting it all together:

        import {Router} from 'mg-bun-router';

        let router = new Router();

        router.get('/*', (req) => {
          return Response.json({hello: 'world'});
        });

        Bun.serve({
          port: 3000,
          async fetch(req) {
            return await router.useRoutes(req);
          }
        });

- Save this as a file, eg named *bws.js*.

- Run it:

        bun bws.js

- Try it out from either within the Container or on the host system:

        curl:http://localhost:3000/a/b/c

        // {"hello": "world"}


----

# Specifying Routes

You can define as many routes as you wish:

        routes[{{method}}]({{path}}, (req) => {
          // do something

          // return a Response object
        });

- {{method}} can be any of:

  - get
  - post
  - patch
  - put
  - delete
  - head
  - options

- {{path}} can define a fixed or parametric path:

  - parameters within the URL path are denoted by a colon (:) prefix
  - you can also specify a wildcard using an asterisk (*)

  For example:

  - /a/b/c
  - /a/b/:c
  - /a/:b/:c
  - /a/*

- The handler method takes a single argument - *req* - which is derived from the incoming *Request* object provided by *Bun.serve*.  *req* pre-parses most of the information you're likely to need and use, but also includes the original raw *Request* object.  The properties of *req* are as follows:

  - method: same as Request.method
  - headers: simple header name/value object derived fron Request.headers
  - body: for POST, PUT and PATCH requests, this contains the results of Request.json()
  - url: same as Request.url,
  - hostname: parsed from the url,
  - protocol: http:// or https://, parsed from the url
  - params: object containing the names and actual values of any specified parametric path elements.  For wildcards, the value is the actual URL sub-path for the part represented by the wildcard
  - pathname: path derived from the url
  - query: object representing any URL querystring parameters as name/value pairs
  - routerPath: the route (including any parameters or wildcards) as specified in the route that has been applied
  - Request: the original raw Request object


  Your handler method should always return a Response object, eg:

          return Response.json({hello: 'world'});

  By default the status code for the Response is 200.  You can customise it, eg:

          return Response.json(res, {status: status}); 

  eg:

          return Response.json({error: 'Unknown route', {status: 401});


Routes are processed in the order you define them in your script file.

----

# Handling Invalid Routes

*mg-bun-router* provides a simple "catch all" means of handling incoming requests that don't match any of your specified routes.

After your list of routes, simply add:

        router.invalid();

This will automatically return:

        Response.json({error: 'Unrecognised request', {status: 401});

You can customise this using an optional argument:

        const errorControlObj = {
          errorText: 'Text to use as error object value',
          status: 400  // or whatever status code value you wish
        }

        router.invalid(errorControlObj);

----

# Serving Static Files

*mg-bun-router* allows you to serve Static files (in addition to any other routes as defined above).

Simply add:

        router.static({{home-path}});

  where {{home-path}} is the file path of the directory that holds the static files you want to serve, eg:

        router.static('/home/ubuntu/www');

Note: You should add *router.static* **after** any other specific *route* definitions.


## router.static in operation

For example, if you request:

        curl http://localhost:3000/index.html

          // text/html response containing contents of /home/ubuntu/www/index.html if it exists

        curl http://localhost:3000/js/app.js

          // text/javascript response containing contents of /home/ubuntu/www/js/app.js if it exists


## Handling invalid file paths

If the specified file path does not exist, *mg-bun-router* will automatically return an error using:

          return Response.json({error: 'Unrecognised request', {status: 401});

You can customise the error response by adding an optional second argument to the *router.static()* method:


        const errorControlObj = {
          errorText: 'Text to use as error object value',
          status: 400  // or whatever status code value you wish
        }

        router.static('/home/ubuntu/www', errorControlObj);

Note that if you have included *router.static()* at the end of your list of routes, you don't need to add the "catch-all" *router.invalid()* route.  

----


## Handling Incoming Requests within QOper8 Workers


So far we've only been using *mg-bun-router* to handle specified routes within the main *Bun.serve* thread.

*mg-bun-router* will also allow you to specify routes that will be handled in Child Processes via the *qoper8-cp* package.  To do that,
you need to specify the API routes and their associated Worker Handler modules in the *options* object that is passed as an optional argument to the *mg-bun-router*'s Constructor.
Worker-handled routes are specified by adding an array named *workerHandlersByRoute* to this *options* object.

Each element of the *workerHandlersByRoute* array is an object that specifies three properties:

- method: get, post, etc
- url: the API URL route, eg /myapi.  This can define either a static route path, a parametric one or one that includes a wild-card.
- handlerPath: the file path of the handler module file that defines how this route will be handled within the Worker.  Note that the path you specify will be relative 
to the directory in which you started your Bun script.

For example, suppose you want the API -  *GET /helloworld* - to be handled in a Worker using a
module named *helloworld.js*, you would create an *options* object something like this:


        const options = {
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/helloworld',
              handlerPath: 'helloWorld.js'
            }
          ]
        }

As a result of the steps shown above, the *mg-bun-router* package will automatically use *QOper8-cp* 
to route all incoming instances of *GET /helloworld* to a Child Process, where they will be handled by your *helloworld.js* module.

## Handler Modules

### Structure/Pattern

*QOper8* Worker Message Handler Modules must export a function with two arguments:

- *messageObj*: the incoming Request object, as repackaged for you by *mg-bun-router* (see earlier)

- *finished*: the method provided by *QOper8* that you must use for returning your response object and releasing the Worker back to the available pool

The export must be to *{handler}*.

For example:

        const handler = function(messageObj, finished) {

          // process the incoming message object


          // on completion, invoke the QOper8 finished() method
          //  to return the response and release the Worker back
          //  to the available pool

          finished({
            ok: true,
            hello: 'world'
          });
        };

        export {handler};


For more details about QOper8 handler modules, see the 
[relevant documentation](https://github.com/robtweed/qoper8-cp#the-message-handler-method-script)

## Initialising/Customising the Worker

You may need to customise the Worker environment and the *this* context of the Worker.  For example you may want each Worker to connect to a database when it first starts, and provide the access credentials for the database via the Worker's *this* context.

You do this via an additional property - *onStartup* - in the *options* object, eg:

        onStartup: {
          module: 'myStartupModule.js'
        }


Note that, just like Handler Modules, the path you specify for a startup module will be relative 
to the directory in which you started your Bun script

For full details about QOper8 Worker Startup Modules, see the 
[relevant documentation](https://github.com/robtweed/qoper8-cp#optional-webworker-initialisationcustomisation)


## Using the YottaDB or IRIS Databases

*mg-bun-router* makes it very easy to access the YottaDB or IRIS Databases via our very high-performance 
[*mg-dbx-napi*](https://github.com/chrisemunt/mg-dbx-napi) interface within your Worker Handler Module.

Simply specify the *mg-dbx-napi* database open parameters via a property named *mgdbx* that you add to the *options* object when instantiating the Router, eg:

- YottaDB:

        let router = new Router({
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/helloworld',
              handlerPath: '../handlers/getHelloWorld.mjs'
            }
          ],
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


- IRIS:

        let router = new Router({
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/helloworld',
              handlerPath: '../handlers/getHelloWorld.mjs'
            }
          ],
          mgdbx: {
            open: {
              type: "IRIS",
              path:"/usr/irissys/mgr",
              username: "_SYSTEM",
              password: "secret",
              namespace: "USER"
            }
          }
        });


Whenever a QOper8 worker is started, it will automatically open a connection to YottaDB or IRIS, and you'll have access within your worker handler modules to all the APIs for both:

- *mg-dbx-napi*; and
- [*glsdb*](https://github.com/robtweed/glsdb), our persistent JSON abstraction for YottaDB and IRIS


To access the *mg-dbx-napi* APIs, use *this.mgdbx* which has the following properties:

- db: the active, opened server/database
- mglobal: the mg-dbx-napi mglobal Class
- mclass: the mg-dbx-napi mclass Class
- mcursor: the mg-dbx-napi mcursor Class

To access the *glsdb* APIs, use *this.glsdb*.  For example, to access a Global Storage document using *glsdb*:

        let doc = new this.glsdb.node('Person');
        let json = doc.$(123).document;

See the *glsdb* documentation for further details.


----

## Worked Example Integrating QOper8 with *mg-bun-router*

Example with two routes, one handled locally within the Bun.server thread, the other handled in a QOper8 Child Process:


### main.js

        import {Router} from 'mg-bun-router';

        const options = {
          logging: true,             // optional - useful when under development to see qoper8 traffic
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/hello/worker',
              handlerPath: 'helloWorld.js'
            }
          ]
        };

        let router = new Router(options);

        router.get('/hello/local', (req) => {
          return Response.json({hello: 'handled locally'});
        });

        router.invalid();

        Bun.serve({
          port: 3000,
          async fetch(req) {
            return await router.useRoutes(req);
          }
        });


### helloWorld.js

        const handler = function(messageObj, finished) {
       
          // process incoming request in messageObj.data

          // return response - contents are for you to determine

          finished({
            ok: true,
            hello: 'handled by Worker'
          });
        };

        export {handler};

To run:

        bun main.js


Try:

        curl http://localhost:3000/hello/local

        curl http://localhost:3000/hello/worker

        curl http://localhost:3000/invalidUrl


----

## Handling Parametric and Wildcard URLs in a QOper8 Workd

Example worker handler definition:

          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/example/:userId',
              handlerPath: 'handlers/getUser.js'
            },
            {
              method: 'get',
              url: '/example/:userId/:token',
              handlerPath: 'handlers/getUserToken.js'
            },
            {
              method: 'get',
              url: '/example/any/*',
              handlerPath: 'handlers/getAny.js'
            }
          ]


If an incoming request matches any of the parametric or wildcard routes, it will be routed to a Worker
and the specified Handler Module will be applied.

The specific incoming values of parameters or a wildcard are accessed via the *messageObj.data.params* object
within your Handler module, eg:

### getUserToken.js

        const handler = function(messageObj, finished) {
       
          let userId = messageObj.data.params.userId;
          let token = messageObj.data.params.token;

          // etc...

          if (invalidUser) {
            finished({
              error: 'Invalid User'
            });
          }
          else {
            finished({
              ok: true,
            });
          }
        };

        export {handler};

----

## Handling Errors in QOper8 Worker Handler Modules

You can return an error from your Handler Module simply by returning an *error* property via the *finished()*
method, eg:

            return finished({
              error: 'Invalid User'
            });

*mg-bun-router* will automatically change the HTTP response status to 400.

You can customise the HTTP response status by adding an *errorCode* property, eg:

            return finished({
              error: 'Invalid User',
              errorCode: 405
            });

*mg-bun-router* removes the *errorCode* property from the response object that is sent to the client, but
changes the HTTP status code of the response.


----

## Customising the Response Headers

*mg-bun-router* also allows you to optionally modify the HTTP response status code and headers, just before
 the Response is sent back to the client. 

You do this via the reserved *http_response* property that you can optionally add to your *finished()* object
within your Message Handler(s).

For example:


      finished({
        ok: true,
        hello: 'world',

        http_response: {
          statusCode: 201,
          headers: {
            authorization: 'mySecretCredential'
          }
        }

      });


## Handling QOper8 Events

The *QOper8* modules emit a number of events that you may want to make use of within your application.

The active *qoper8* object is available via the router property:

- router.qoper8

You can therefore use its *on()* method, for example, to see when/if workers are started and to see a count of requests handled by each worker, eg:

        let router = new Router(options);
          // ...etc

        let counts = {};

        router.qoper8.on('workerStarted', function(id) {
          console.log('worker ' + id + ' started');
        });

        router.qoper8.on('workerStopped', function(id) {
          console.log('worker ' + id + ' stopped');
          delete counts[id];
        });

        router.qoper8.on('replyReceived', function(res) {
          let id = res.workerId;
          if (!counts[id]) counts[id] = 0;
          counts[id]++;
        });

        let countTimer = setInterval(() => {
          console.log('messages handled:');
          for (let id in counts) {
            console.log(id + ': ' + counts[id]);
          }
          console.log('-----');
        }, 20000);

        router.qoper8.on('stop', () => {
          clearInterval(countTimer);
        });



## License

 Copyright (c) 2023-24 MGateway Ltd,                           
 Redhill, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  https://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
