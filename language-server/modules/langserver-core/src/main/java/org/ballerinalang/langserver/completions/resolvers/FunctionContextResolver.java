/*
*  Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
*
*  WSO2 Inc. licenses this file to you under the Apache License,
*  Version 2.0 (the "License"); you may not use this file except
*  in compliance with the License.
*  You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing,
*  software distributed under the License is distributed on an
*  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
*  KIND, either express or implied.  See the License for the
*  specific language governing permissions and limitations
*  under the License.
*/
package org.ballerinalang.langserver.completions.resolvers;

import org.antlr.v4.runtime.ParserRuleContext;
import org.ballerinalang.langserver.compiler.DocumentServiceKeys;
import org.ballerinalang.langserver.compiler.LSServiceOperationContext;
import org.ballerinalang.langserver.completions.util.CompletionItemResolver;
import org.eclipse.lsp4j.CompletionItem;

import java.util.ArrayList;

/**
 * Completion Item resolver for the BLangFunction context.
 */
public class FunctionContextResolver extends AbstractItemResolver {
    @Override
    public ArrayList<CompletionItem> resolveItems(LSServiceOperationContext completionContext) {
        ParserRuleContext parserRuleContext = completionContext.get(DocumentServiceKeys.PARSER_RULE_CONTEXT_KEY);
        AbstractItemResolver contextResolver = CompletionItemResolver.getResolverByClass(parserRuleContext.getClass());
        if (contextResolver != null) {
            return contextResolver.resolveItems(completionContext);
        }
        return null;
    }
}
