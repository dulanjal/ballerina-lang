/**
 * Copyright (c) 2017, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import _ from 'lodash';
import Node from './tree/node';

const isRetry = n => n.kind === 'Retry';

// TODO: Move this to a generic place.
function requireAll(requireContext) {
    const comp = {};
    requireContext.keys().forEach((item) => {
        const module = requireContext(item);
        if (module.default) {
            comp[module.default.name] = module.default;
        }
    });
    return comp;
}

const treeNodes = requireAll(require.context('./tree/', true, /\.js$/));

/**
 * A utill class to build the client side AST from serialized JSON.
 *
 * @class TreeBuilder
 */
class TreeBuilder {

    /**
     * Will convert any branch of json serialized ballerina AST tree to a node branch
     * of client side model.
     *
     * @static
     * @param {Object} json Serialized json of a ast tree or branch.
     * @param {Node} parent Parent node.
     * @returns {Node} object tree of node elements.
     * @memberof TreeBuilder
     */
    static build(json, parent, parentKind) {
        let childName;
        // 1. Backend API will send a serialized json of the AST tree.
        // 2. We consider all the json objects in the serialized json as nodes.
        // 3. If a node is found we bind the node objects prototype to that.
        // 4. If there is a more specific node defined based on node kind we will use
        //    that object instead of generic object.

        // Special case node creation with kind.
        let node;
        const kind = json.kind;
        if (kind && treeNodes[kind + 'Node']) {
            node = new (treeNodes[kind + 'Node'])();
        } else {
            node = new Node();
        }
        // with the following loop we will recursivle dive in to the child nodes and convert.
        for (childName in json) {
            // if child name is position || whitespace skip convection.
            if (childName !== 'position' && childName !== 'ws') {
                const child = json[childName];
                if (_.isPlainObject(child) && child.kind) {
                    json[childName] = TreeBuilder.build(child, node, kind);
                } else if (child instanceof Array) {
                    for (let i = 0; i < child.length; i++) {
                        const childItem = child[i];
                        if (kind === 'CompilationUnit' && childItem.kind === 'Function' && childItem.lambda) {
                            child.splice(i, 1);
                            i--;
                        } else if (_.isPlainObject(childItem) && childItem.kind) {
                            child[i] = TreeBuilder.build(childItem, node, kind);
                        }
                    }
                }
            }
        }

        TreeBuilder.modifyNode(json, parentKind);

        json.parent = parent;
        Object.assign(node, json);
        node.setChildrenCompoundStatus();
        return node;
    }

    static modifyNode(node, parentKind) {
        const kind = node.kind;
        if (kind === 'If' && node.elseStatement && node.elseStatement.kind === 'If') {
            node.ladderParent = true;
        }

        if (kind === 'Transaction') {
            if (node && node.condition && node.condition.value) {
                const retry = (node.failedBody ? node.failedBody.statements.filter(isRetry)[0] : null) ||
                    (node.committedBody ? node.committedBody.statements.filter(isRetry)[0] : null) ||
                    node.transactionBody.statements.filter(isRetry)[0];
                if (retry) {
                    retry.count = node.condition.value;
                }
            }
        }
        if (kind === 'XmlElementLiteral' && parentKind !== 'XmlElementLiteral') {
            node.root = true;
        }

        if (kind === 'AnnotationAttachment' && node.packageAlias.value === 'builtin') {
            node.builtin = true;
        }

        if (kind === 'Identifier') {
            if (node.literal) {
                node.valueWithBar = '^"' + node.value + '"';
            } else {
                node.valueWithBar = node.value;
            }
        }

        if (kind === 'Import') {
            if (node.alias && node.alias.value && node.packageName && node.packageName.length) {
                if ((node.alias.value !== node.packageName[node.packageName.length - 1].value)) {
                    node.userDefinedAlias = true;
                }
            }
            if (node.packageName.length === 2
                && node.packageName[0].value === 'transactions' && node.packageName[1].value === 'coordinator') {
                node.isInternal = true;
            }
        }

        if (parentKind === 'XmlElementLiteral' || parentKind === 'XmlCommentLiteral' ||
            parentKind === 'StringTemplateLiteral') {
            node.inTemplateLiteral = true;
        }

        if (parentKind === 'CompilationUnit' && (kind === 'Variable' || kind === 'Xmlns')) {
            node.global = true;
        }

        if (node.kind === 'VariableDef' && node.variable.typeNode && node.variable.typeNode.kind === 'EndpointType') {
            node.variable.endpoint = true;
            node.endpoint = true;
        }

        if (node.kind === 'Variable') {
            if (node.initialExpression && node.initialExpression.async) {
                if (node.ws) {
                    let wsLength = node.ws.length;
                    for (let i = 0; i < wsLength; i++) {
                        if (node.ws[i].text === 'start') {
                            if (node.initialExpression.ws) {
                                node.initialExpression.ws.splice(0, 0, node.ws[i]);
                                node.ws.splice(i, 1);
                            }
                        }
                    }
                }
            }

            if (node.typeNode && node.typeNode.nullable && node.typeNode.ws) {
                for (let i = 0; i < node.typeNode.ws.length; i++) {
                    if (node.typeNode.ws[i].text === '?') {
                        node.typeNode.nullableOperatorAvailable = true;
                        break;
                    }
                }
            }
        }

        if (node.kind === 'Service') {
            if (!node.serviceTypeStruct) {
                node.isServiceTypeUnavailable = true;
            }
        }

        // Mark the first argument ad a service endpoint.
        if (node.kind === 'Resource' && node.parameters[0]) {
            const endpointParam = node.parameters[0];
            const valueWithBar = endpointParam.name.valueWithBar || endpointParam.name.value;
            endpointParam.serviceEndpoint = true;
            endpointParam.name.setValue(endpointParam.name.getValue().replace('$', ''));
            endpointParam.name.valueWithBar = valueWithBar.replace('$', '');
        }

        // Add the positions for the join and timeout bodies.
        if (node.kind === 'ForkJoin') {
            if (node.joinBody) {
                node.joinBody.position = node.joinResultVar.position;
            }

            if (node.timeoutBody) {
                node.timeoutBody.position = node.timeOutExpression.position;
            }
        }

        // Check if sorrounded by curlies
        if (node.kind === 'MatchPatternClause') {
            if (!node.ws) {
                node.withoutCurlies = true;
            }
        }

        // Check if sorrounded by parantheses
        if (node.kind === 'ValueType') {
            if (node.ws && node.ws.length > 2) {
                node.withParantheses = true;
            }
        }

        if (node.kind === 'UnionTypeNode') {
            if (node.ws && node.ws.length > 2) {
                node.withParantheses = true;
            }
        }

        if (node.kind === 'Function') {
            if (node.returnTypeNode && node.returnTypeNode.typeKind !== 'nil') {
                node.hasReturns = true;
                if (node.ws) {
                    for (let i = 0; i < node.ws.length; i++) {
                        if (node.ws[i].text === ')' && node.ws[i + 1].text !== 'returns') {
                            let returnTypeWsLength = node.returnTypeNode.ws.length;
                            for (let j = 0; j < returnTypeWsLength; j++) {
                                if (node.returnTypeNode.ws[j].text === 'returns') {
                                    node.ws.splice((i + 1), 0, node.returnTypeNode.ws[j]);
                                    node.returnTypeNode.ws.splice(j, 1);
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            if (node.receiver && !node.receiver.ws) {
                node.noVisibleReceiver = true;
            }

            if (node.restParameters && node.parameters && node.parameters.length > 0) {
                node.hasRestParams = true;
            }

            if (node.restParameters && node.restParameters.typeNode) {
                node.restParameters.typeNode.isRestParam = true;
            }
        }

        if (node.kind === 'Object') {
            node.publicFields = [];
            node.privateFields = [];
            let fields = node.fields;
            let privateFieldBlockVisible = false;
            let publicFieldBlockVisible = false;

            for (let i = 0; i < fields.length; i++) {
                if (fields[i].public) {
                    node.publicFields.push(fields[i]);
                } else {
                    node.privateFields.push(fields[i]);
                }
            }

            if (node.ws) {
                for (let i = 0; i < node.ws.length; i++) {
                    if (node.ws[i].text === 'public' && node.ws[i + 1].text === '{') {
                        publicFieldBlockVisible = true;
                    }

                    if (node.ws[i].text === 'private' && node.ws[i + 1].text === '{') {
                        privateFieldBlockVisible = true;
                    }
                }
            }

            if (node.privateFields.length <= 0 && !privateFieldBlockVisible) {
                node.noPrivateFieldsAvailable = true;
            }

            if (node.publicFields.length <= 0 && !publicFieldBlockVisible) {
                node.noPublicFieldAvailable = true;
            }

            if (fields.length <= 0 && node.noPrivateFieldsAvailable && node.noPublicFieldAvailable) {
                node.noFieldsAvailable = true;
            }

            if (node.initFunction) {
                if (!node.initFunction.ws) {
                    node.initFunction.defaultConstructor = true;
                } else {
                    node.initFunction.isConstructor = true;
                }
            }
        }

        if (node.kind === 'TypeInitExpr') {
            if (node.expressions.length <= 0) {
                node.noExpressionAvailable = true;
            }

            if (node.ws) {
                for (let i = 0; i < node.ws.length; i++) {
                    if (node.ws[i].text === "(") {
                        node.hasParantheses = true;
                        break;
                    }
                }
            }

            if (!node.type) {
                node.noTypeAttached = true;
            } else {
                node.typeName = node.type.typeName;
            }
        }

        if (node.kind === 'Return') {
            if (node.expression && node.expression.kind === 'Literal') {
                if (node.expression.value === '()') {
                    node.noExpressionAvailable = true;
                }

                if (node.expression.value === 'null') {
                    node.emptyBrackets = true;
                }
            }
        }

        if (node.kind === "Documentation") {
            for (let j = 0; j < node.attributes.length; j++) {
                let attribute = node.attributes[j];
                if (attribute.ws) {
                    let wsLength = attribute.ws.length;
                    for (let i = 0; i < wsLength; i++) {
                        let text = attribute.ws[i].text;
                        if (text.includes('{{') && !attribute.paramType) {
                            let lastIndex = text.indexOf('{{');
                            let paramType = text.substr(0, lastIndex);
                            let startCurl = text.substr(lastIndex, text.length);
                            attribute.ws[i].text = paramType;
                            attribute.paramType = paramType;
                            attribute.ws.splice((++i), 0, {text: startCurl, ws: "", static: false});
                        }
                    }
                }
            }
        }

        // Tag rest variable nodes
        if (node.kind === 'Function' || node.kind === 'Resource') {
            if (node.restParameters) {
                node.restParameters.rest = true;
            }
        }

        if (node.kind === 'PostIncrement') {
            node.operator = node.operatorKind + node.operatorKind;
        }
    }

    static modify(tree, parentKind = null) {
        TreeBuilder.modifyNode(tree, parentKind);
        for (const childKeyVal of tree) {
            TreeBuilder.modify(childKeyVal[1], tree.kind);
        }
    }
}

export default TreeBuilder;
