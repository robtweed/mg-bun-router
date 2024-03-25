/*
 ----------------------------------------------------------------------------
 | mg-bun-router: Router for Bun.serve                                       |
 |                                                                           |
 | Copyright (c) 2024 MGateway Ltd,                                          |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

24 March 2024

*/

const findMyWay = require('find-my-way')();
import fs from 'fs';
import crypto from 'crypto';
import {QOper8} from 'qoper8-cp';

function parseCookies(cookieStr) {
  let cookies = {};
  if (!cookieStr || cookieStr === '') return cookies;
  let pcs = cookieStr.split(';');
  for (let cookie of pcs) {
   let nvp = cookie.split('=');
   cookies[nvp[0].trim()] = nvp[1];
  }
  return cookies;
}

class Router {
  constructor(options) {
    this.context = {};
    this.types = new Map();

    options = options || {};
    if (typeof options.logging === 'undefined') options.logging = false;
    if (typeof options.exitOnStop === 'undefined') options.exitOnStop = true;
    if (typeof options.poolSize === 'undefined') options.poolSize = 2;
    if (!options.workerHandlersByRoute) options.workerHandlersByRoute = [];
    let qoper8 = new QOper8(options);
    let R = this;
    for (let route of options.workerHandlersByRoute) {
      qoper8.handlersByMessageType.set(route.url, {module: route.handlerPath});
      this.route(route.method.toUpperCase(), route.url, async function(req) {
        return await R.useQoper8(req)
      });
    }
    this.qoper8 = qoper8;
  }

  route(method, routerPath, handlerFn) {
    if (!method) return;
    if (!routerPath) return;
    if (!handlerFn || typeof handlerFn !== 'function') return;

    let R = this;
    findMyWay.on(method, routerPath, async function(Request, params) {
      let url = new URL(Request.url);
      let body;
      if (Request.method === 'POST' || Request.method === 'PUT' || Request.method === 'PATCH') {
        try {
          body = await Request.json();
        }
        catch(err) {
        }
      }
      
      let req = {
        method: Request.method,
        headers: Object.fromEntries(Request.headers.entries()),
        body: body,
        url: Request.url,
        hostname: url.hostname,
        protocol: url.protocol,
        params: params,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        cookies: parseCookies(Request.headers.get('Cookie')),
        routerPath: routerPath,
        Request: Request
      };

      let res;
      if (handlerFn.constructor.name === 'AsyncFunction') {
        res = await handlerFn.call(R, req, R.context);
      }
      else {
        res = handlerFn.call(R, req, R.context);
      }
      return res;
    });
  }

  get(url, handlerFn) {
    this.route('GET', url, handlerFn);
  }

  post(url, handlerFn) {
    this.route('POST', url, handlerFn);
  }

  put(url, handlerFn) {
    this.route('PUT', url, handlerFn);
  }

  delete(url, handlerFn) {
    this.route('DELETE', url, handlerFn);
  }

  head(url, handlerFn) {
    this.route('HEAD', url, handlerFn);
  }

  options(url, handlerFn) {
    this.route('OPTIONS', url, handlerFn);
  }

  patch(url, handlerFn) {
    this.route('PATCH', url, handlerFn);
  }

  async useRoutes(req) {
    let route = findMyWay.find(req.method, req.url);
    if (route) {
      return await route.handler(req, route.params);
    }
    else {
      return false;
    }
  }

  async useQoper8(req) {
    delete req.Request;
    let res = await this.qoper8.send({
      type: req.routerPath,
      data: req
    });
    delete res.qoper8;

    if (res.error) {
      let status = 400;
      if (res.errorCode) {
        status = res.errorCode;
        delete res.errorCode;
      }
      return Response.json(res, {status: status});
    }
    else {
      let options;
      if (res.http_response) {
        if (res.http_response.statusCode) {
          options = {status: res.http_response.statusCode}
        }
        if (res.http_response.headers) {
          if (!options) options = {};
          options.headers = res.http_response.headers;
        }
        delete res.http_response;
      }
      return Response.json(res, options);
    }
  }

  static(homePath, errControl) {
    if (homePath.slice(-1) === '/') {
      homePath = homePath.slice(0, -1);
    }
    this.get('/*', async function(req) {
      let path = req.pathname;
      if (path === '/') path = "/index.html";
      path = homePath + path;
      let res;
      try {
        await fs.promises.access(path, fs.constants.F_OK);
        res = new Response(Bun.file(path));
      }
      catch (err) {
        errControl = errControl || {};
        res = this.unrecognised(errControl);
      }
      return res;
    });
    this.invalid(errControl, ['get']);
  }

  invalid(errControl, exclude) {
    errControl = errControl || {};
    exclude = exclude || [];
    const methods = ['get', 'post', 'put', 'delete', 'head', 'options', 'patch'];
    for (let method of methods) {
      if (!exclude.includes(method)) {
        this[method]('/*', async function(req) {
          return this.unrecognised(errControl);
        });
      }
    }
  }

  unrecognised(obj) {
    obj = obj || {};
    let errorText = obj.errorText || 'Unrecognised request';
    let status = obj.status || 401;
    return Response.json({error: errorText}, {status: status});
  }
}

export {Router};
