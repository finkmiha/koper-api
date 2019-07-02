"use strict";

const fs = require("fs");
const acorn = require("acorn");
const acornWalk = require("acorn/dist/walk");
const commentParser = require("comment-parser");

const assign = require("lodash.assign");

/**
 * Function that loads and parses the given file.
 * Build AST and a list of comments.
 *
 * @param {string} fileName
 *
 * @returns {object} An object with ast and comments as properties.
 */
function parse(fileName) {
  // Read the file.
  let source = fs.readFileSync(fileName);
  let comments = [];

  // Parse the text.
  let ast = acorn.parse(source, {
    // Ranges: true, // collect ranges for each node
    onComment: comments, // Collect comments in Esprima's format
    // onToken: tokens, // collect token ranges
    ecmaVersion: 8,
    sourceType: "module"
  });

  // Return the abstract syntax tree.
  return {
    ast,
    comments
  };
}

function resolveType(typeStr) {
  // Remove all whitespace and cast to lower case.
  typeStr = typeStr.replace(/\s/g, "");
  typeStr = typeStr.toLowerCase();
  // Split by pipes if there is more than one possible type.
  let tokens = typeStr.split("|");
  // For now just take the last one.
  typeStr = tokens.pop();
  // Check if the type is an array.
  if (typeStr.endsWith("[]")) {
    return {
      type: "array",
      items: resolveType(typeStr.substr(0, typeStr.length - 2))
    };
  } else
    return {
      type: typeStr
    };
}

function createDocsFromComments(text) {
  let parseOptions = {};
  parseOptions.dotted_names = false;
  let blocks = commentParser(text, parseOptions);

  let docs = {
    params: [],
    returns: null,
    description: null,
    summary: null,
    blocks: blocks
  };

  if (blocks.length <= 0) {
    return docs;
  }
  let block = blocks[0];

  // Get description and summary.
  docs.description = block.description;
  docs.summary = block.description.split("\n")[0];

  // Collect data from tags.
  for (let tag of block.tags) {
    if (tag.tag === "param") {
      tag.type = resolveType(tag.type);
      docs.params.push(
        assign(
          {
            name: tag.name,
            required: !tag.optional,
            // defaultValue: 'defVal',
            description: tag.description
          },
          tag.type
        )
      );
    } else if (tag.tag === "returns") {
      tag.type = resolveType(tag.type);
      docs.returns = assign(
        {
          description: tag.description
        },
        tag.type
      );
    }
  }

  return docs;
}

/**
 * Extract exported functions and their docs.
 *
 * @param {string} fileName
 *
 * @return {Map} Exporteds map. Keys are function names. Values are function details.
 */
function extractExported(fileName) {
  // Load the controller file.
  let result = parse(fileName);
  let controllerAst = result.ast;
  let comments = result.comments;
  let commentsMap = new Map();
  comments.forEach(comment => {
    if (comment.type != "Block") {
      return;
    }
    commentsMap.set(comment.end + 1, comment);
    // Fix for windows - windows has 2 Byte line endings CL, RF
    commentsMap.set(comment.end + 2, comment);
  });

  let functions = new Map();
  let exporteds = new Map();
  acornWalk.ancestor(controllerAst, {
    FunctionDeclaration: function(node, state, ancestors) {
      // Only check the function declarations on the first level.
      if (ancestors.length > 2) {
        return;
      }
      functions.set(node.id.name, {
        node: node,
        docs: null
      });
    },
    AssignmentExpression: function(node, state, ancestors) {
      // Get the module exports.
      // Only check the assignment expressions on the first level.
      if (ancestors.length > 3) {
        return;
      }
      if (node.operator != "=") {
        return;
      }
      let left = node.left;
      if (left.type != "MemberExpression") {
        return;
      }
      if (left.object.name != "module") {
        return;
      }
      if (left.property.name != "exports") {
        return;
      }
      let right = node.right;
      if (right.type != "ObjectExpression") {
        return;
      }
      for (let property of right.properties) {
        if (property.key.type != "Identifier") {
          console.log(`Exported property "${property.key.name}" key of type "${property.key.type}" in file "${fileName}" not handled.`);
          continue;
        }
        if (property.value.type != "Identifier") {
          console.log(`Exported property "${property.key.name}" value of type "${property.value.type}" in file "${fileName}" not handled.`);
          continue;
        }
        if (!functions.has(property.value.name)) {
          console.log(`Exported property "${property.key.name}" in file "${fileName}" is not a function.`);
          continue;
        }

        // Map the function from value to key.
        exporteds.set(property.key.name, functions.get(property.value.name));
      }
    }
  });

  for (let [fnName, fnData] of exporteds) {
    let commentText = "";
    fnData.hasDocs = false;
    if (commentsMap.has(fnData.node.start)) {
      let commentBlock = commentsMap.get(fnData.node.start);
      commentText = "/*" + commentBlock.value + "*/";
      fnData.hasDocs = true;
    }
    fnData.docs = createDocsFromComments(commentText);
  }

  return exporteds;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
  parse,
  extractExported,
  createDocsFromComments
};
