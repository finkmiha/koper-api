"use strict";

const isString = require("lodash.isstring");
const acornWalk = require("acorn/dist/walk");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const pathToRegexp = require("path-to-regexp");
const parseModule = require("./parse-module");

function getJSFilePath(rootPath, fileName) {
  let filePath = path.join(rootPath, fileName);
  if (!filePath.endsWith(".js")) filePath += ".js";
  return filePath;
}

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function routePathTokensToSwagger(tokens) {
  let swaggerPath = "";
  for (let token of tokens) {
    if (isString(token)) {
      swaggerPath += token;
    } else {
      if (isString(token.name)) {
        swaggerPath += token.prefix + "{" + token.name + "}";
      } else {
        swaggerPath += token.prefix + "(" + token.pattern + ")";
      }
      if (token.optional) {
        if (token.repeat) swaggerPath += "*";
        else swaggerPath += "?";
      } else if (token.repeat) swaggerPath += "+";
    }
  }
  return swaggerPath;
}

function getTagsFromControllerName(name) {
  if (!isString(name)) return [];
  if (name.length < 1) return [];

  const ending = "Controller";
  if (name.endsWith(ending)) {
    name = name.substr(0, name.length - ending.length);
  }

  return name;
}

function generate(options) {
  options = options || {};
  let router = options.router;

  // Check if route file exists.
  if (fs.existsSync(path)) {
    throw new Error(`Routes file ${options.routesFile} not found.`);
  }
  let rootPath = path.dirname(options.routesFile);
  let routesFileName = "./" + path.basename(options.routesFile);

  // Load the current state.
  let oldState = {};
  try {
    let stateJson = fs.readFileSync(options.stateDoc, "utf8");
    oldState = JSON.parse(stateJson);
  } catch (error) {}

  // Check if routes file changed.
  let stateChanged = false;
  let modifiedOn = fs.statSync(options.routesFile).mtime.getTime();
  let newState = {};
  if ((oldState[routesFileName] !== modifiedOn) || options.alwaysGenerate) {
    // Parse routes.
    newState[routesFileName] = modifiedOn;
    stateChanged = true;

    // Load the routes file.
    let routesAst = parseModule.parse(options.routesFile).ast;

    // Walk the ASTree.
    let requires = new Map();
    let koaRouterName = null;
    let routerNames = new Set();
    let allowedMethods = new Set([
      "head",
      "options",
      "get",
      "put",
      "patch",
      "post",
      "delete",
      "del"
    ]);
    acornWalk.ancestor(routesAst, {
      VariableDeclarator: function(node, state, ancestors) {
        // Only check the variable declarations on the first level.
        // if (ancestors.length > 3) return;

        let init = node.init;
        if (init.type === "CallExpression") {
          // We want to get all required controllers and the variable that is the "koa-router" dependency.
          if (init.callee.name !== "require") return;
          for (let arg of init.arguments) {
            if (arg.type !== "Literal") {
              console.log(
                'NOTE: Require expression of type "' +
                  arg.type +
                  '" could not be processed.'
              );
              continue;
            }
            let val = arg.value;
            if (!val.endsWith(".js")) val += ".js";
            requires.set(node.id.name, val);
            if (val === "koa-router.js") koaRouterName = node.id.name;
          }
        } else if (init.type === "NewExpression") {
          // Here we want to get all instances of the koa router.
          if (koaRouterName == null) return;
          if (init.callee.name === koaRouterName) routerNames.add(node.id.name);
        }
      },
      ExpressionStatement: function(node, state, ancestors) {
        // Here we want to get all registered routes. (router.[METHOD] calls).
        if (node.expression.type !== "CallExpression") return;
        let callee = node.expression.callee;
        if (!routerNames.has(callee.object.name)) return;
        if (!allowedMethods.has(callee.property.name)) return;

        let method = callee.property.name;
        if (method === "del") method = "delete";

        let route = {
          method: method,
          name: null,
          regex: null,
          controllerFileName: null,
          controllerVarName: null,
          functionName: null
        };

        // Loop through all arguments of the router.[METHOD](...) call.
        // The last "MemberExpression" should be the call function.
        let lastMeberExpression = null;
        for (let arg of node.expression.arguments) {
          if (arg.type === "Literal") {
            if (arg.value == null) route.regex = arg.value;
            else {
              route.name = route.regex;
              route.regex = arg.value;
            }
          } else if (arg.type === "MemberExpression") {
            lastMeberExpression = arg;
          }
        }

        // Check if the call function can be found.
        if (lastMeberExpression == null) {
          console.log(
            "NOTE: Route [" +
              route.method.toUpperCase() +
              "] " +
              route.name +
              ' "' +
              route.regex +
              '" controller function could not be resolved.'
          );
          return;
        }

        // Check if the filename where this function is defined can be resolved.
        route.controllerVarName = lastMeberExpression.object.name;
        route.functionName = lastMeberExpression.property.name;
        if (!requires.has(route.controllerVarName)) {
          console.log(
            "NOTE: Route [" +
              route.method.toUpperCase() +
              "] " +
              route.name +
              ' "' +
              route.regex +
              '" controller "' +
              route.controllerVarName +
              '" could not be resolved.'
          );
          return;
        }
        route.controllerFileName = requires.get(route.controllerVarName);

        // Push the route to the belonging controller.
        if (newState[route.controllerFileName] == null)
          newState[route.controllerFileName] = {
            functions: {},
            routes: []
          };
        let controllerState = newState[route.controllerFileName];
        controllerState.routes.push(route);
        controllerState.functions[route.functionName] = {};
      }
    });

    // Check if koa router was found.
    if (koaRouterName == null)
      throw new Error(
        `Koa router was not found in the "${options.routesFile}" file.`
      );
  } else {
    // Copy the old state to the new.
    newState = oldState;
  }

  // Check if this (generator) file changed.
  modifiedOn = fs.statSync(__filename).mtime.getTime();
  if (newState["thisModifiedOn"] != modifiedOn) {
    newState["thisModifiedOn"] = modifiedOn;
    stateChanged = true;
  }

  // Check if any controllers need to be re-parsed.
  for (let ctrlFileName in newState) {
    if (!newState.hasOwnProperty(ctrlFileName)) continue;
    if (ctrlFileName === routesFileName) continue;
    if (ctrlFileName === "thisModifiedOn") continue;

    // Check each function if it needs to be updated.
    let oldControllerState = {};
    let reparseController = true;
    let controllerState = newState[ctrlFileName];
    if (oldState[ctrlFileName] != null) {
      reparseController = false;
      oldControllerState = oldState[ctrlFileName];

      // Check if the file modified date changed.
      let modifiedOn = fs
        .statSync(path.join(rootPath, ctrlFileName))
        .mtime.getTime();
      reparseController = modifiedOn != oldControllerState.modifiedOn;
      controllerState.modifiedOn = modifiedOn;
      if (!reparseController) {
        // Check if each function exists in the old controller.
        for (let functionName in controllerState.functions) {
          if (!controllerState.functions.hasOwnProperty(functionName)) continue;
          if (
            oldControllerState.functions == null ||
            oldControllerState.functions[functionName] == null
          ) {
            reparseController = true;
            break;
          }
        }

        // Copy the functions over.
        if (!reparseController && stateChanged) {
          for (let functionName in controllerState.functions) {
            if (!controllerState.functions.hasOwnProperty(functionName))
              continue;
            // Copy the function over to the new state.
            controllerState.functions[functionName] =
              oldControllerState.functions[functionName];
          }
        }
      }
    }

    if (reparseController || options.alwaysGenerate) {
      stateChanged = true;

      // Extract exported functions from the controller.
      let exporteds = parseModule.extractExported(getJSFilePath(rootPath, ctrlFileName));

      // Generate docs for each called function.
      for (let functionName in controllerState.functions) {
        if (!controllerState.functions.hasOwnProperty(functionName)) continue;
        if (!exporteds.has(functionName)) {
          controllerState.functions[functionName] = {};
          continue;
        }

        let fnData = exporteds.get(functionName);
        if (!fnData.hasDocs) {
          console.error(
            'Function "' +
              functionName +
              '" in file "' +
              ctrlFileName +
              '" has no documentation comment block.'
          );
        }

        controllerState.functions[functionName] = fnData.docs;
      }
    }
  }

  // Map the router stack.
  let routerRoutes = new Map();
  for (let route of router.stack) {
    let pathParams = new Set();
    for (let pathParam of route.paramNames) pathParams.add(pathParam.name);
    routerRoutes.set(route.name, {
      route: route,
      pathParams: pathParams,
      security: route.namesStack.slice()
    });
  }

  // Generate swagger path for each route.
  if (stateChanged || options.alwaysGenerate) {
    console.log("Generating swagger API documentation.");

    let swaggers = {};
	let routesExport = new Map();
	let ctrlFileNames = Object.keys(newState);
	ctrlFileNames.sort();
    for (let ctrlFileName of ctrlFileNames) {
      if (!newState.hasOwnProperty(ctrlFileName)) continue;
      if (ctrlFileName === routesFileName) continue;
      if (ctrlFileName === "thisModifiedOn") continue;
      let controllerState = newState[ctrlFileName];
      for (let route of controllerState.routes) {
        let fnData = controllerState.functions[route.functionName];

        let parameters = [];
        let pathParams = new Set();
        let security = [];
        if (routerRoutes.has(route.name)) {
          let routerRoute = routerRoutes.get(route.name);
          pathParams = routerRoute.pathParams;
          security = routerRoute.security;
        }

        for (let parameter of fnData.params) {
          let inType = "formData";
          if (pathParams.has(parameter.name)) inType = "path";
          else if (route.method === "get") inType = "query";
          parameters.push({
            name: parameter.name,
            in: inType,
            description: parameter.description,
            required: parameter.required,
            type: parameter.type
          });
        }

        let pathTokens = pathToRegexp.parse(route.regex);
        let routePath = routePathTokensToSwagger(pathTokens);
        let tag = getTagsFromControllerName(route.controllerVarName);

        // Get group from routesExport.
        if (!routesExport.has(tag)) {
          routesExport.set(tag, []);
        }
        let group = routesExport.get(tag);

        // Add route to the group.
        group.push({
          alias: route.name,
          method: route.method,
          urlRegex: route.regex,
          description: fnData.description,
          summary: fnData.summary,
          parameters: parameters,
          middleware: security
        });

        if (swaggers[routePath] == null) swaggers[routePath] = {};
        swaggers[routePath][route.method] = {
          tags: [tag],
          description: fnData.description,
          summary:
            route.name +
            "&nbsp&nbsp&nbsp&nbsp-&nbsp&nbsp&nbsp&nbsp" +
            fnData.summary,
          operationId: route.name,
          "x-controller": [
            {
              file: path.basename(
                route.controllerFileName,
                path.extname(route.controllerFileName)
              ),
              handler: route.functionName
            }
          ],
          parameters: parameters
          //security: security,
          /*responses: {
            200: {
              description: 'OK',
              schema: {
                type: 'object',
                properties: {
                  message: {type: 'string'},
                },
              },
            },
            400: {
              description: 'Bad request',
              schema: {
                type: 'object',
                properties: {
                  message: {type: 'string'},
                },
              },
            },
            401: {
              description: 'Not authorized',
              schema: {
                type: 'object',
                properties: {
                  message: {type: 'string'},
                },
              },
            },
          },*/
        };
      }
    }

    let contact = {};
    if (options.contactName != null) contact.name = options.contactName;
    if (options.contactEmail != null) contact.email = options.contactEmail;

    let swaggerData = {
      swagger: "2.0",
      info: {
        version: options.version,
        title: options.title
      },
      contact: contact,
      consumes: ["application/json", "application/x-www-form-urlencoded"],
      produces: ["application/json", "text/html"],
      basePath: router.opts.prefix || "/",
      paths: swaggers
    };
    if (options.description != null)
      swaggerData.description = options.description;

    let routesExportObj = [];
    for (let [k, v] of routesExport) {
      routesExportObj.push({
        groupName: k,
        routes: v
      });
    }

    // Write the new state if anything has changed.
    ensureDirectoryExistence(options.stateDoc);
    fs.writeFileSync(options.stateDoc, JSON.stringify(newState));
    ensureDirectoryExistence(options.apiDoc);
    fs.writeFileSync(options.apiDoc, yaml.safeDump(swaggerData));
    if (options.routesExportDoc != null) {
      let routesJson = JSON.stringify(routesExportObj);
      ensureDirectoryExistence(options.routesExportDoc);
      fs.writeFileSync(options.routesExportDoc, routesJson);
    }
  }
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
  generate
};
