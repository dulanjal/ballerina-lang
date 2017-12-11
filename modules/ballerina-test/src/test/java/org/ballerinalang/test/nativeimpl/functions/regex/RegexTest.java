/*
 *  Copyright (c) 2017, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.ballerinalang.test.nativeimpl.functions.regex;

import org.ballerinalang.launcher.util.BCompileUtil;
import org.ballerinalang.launcher.util.BRunUtil;
import org.ballerinalang.launcher.util.CompileResult;
import org.ballerinalang.model.values.BBoolean;
import org.ballerinalang.model.values.BString;
import org.ballerinalang.model.values.BStringArray;
import org.ballerinalang.model.values.BValue;
import org.testng.Assert;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

/**
 * Test Native functions in ballerina.regex.
 */
public class RegexTest {

    private static final String s1 = "WSO2 Inc.";
    private CompileResult result;

    @BeforeClass
    public void setup() {
        result = BCompileUtil.compile(this, "test-src", "regex/regex-test.bal");
    }

    @Test
    public void testMatches() {
        BValue[] args = { new BString(s1), new BString("WSO2.*") };
        BValue[] returns = BRunUtil.invoke(result, "matches", args);
        Assert.assertTrue(returns[0] instanceof BBoolean);
        Assert.assertEquals(((BBoolean) returns[0]).booleanValue(), true);
    }

    @Test
    public void testFindAll() {
        BValue[] args = { new BString("This is a sentence."), new BString("[a-zA-Z]*is") };
        BValue[] returns = BRunUtil.invoke(result, "findAll", args);
        Assert.assertTrue(returns[0] instanceof BStringArray);
        BStringArray bStringArray = (BStringArray) returns[0];
        Assert.assertEquals(bStringArray.get(0), "This");
        Assert.assertEquals(bStringArray.get(1), "is");
    }

    @Test
    public void testReplaceAllRgx() {
        BValue[] args = { new BString("abc is not abc as abc anymore"), new BString("[a-zA-Z]*bc"),
                new BString("xyz") };
        BValue[] returns = BRunUtil.invoke(result, "replaceAllRgx", args);
        Assert.assertTrue(returns[0] instanceof BString);
        Assert.assertEquals(returns[0].stringValue(), "xyz is not xyz as xyz anymore");
    }

    @Test
    public void testReplaceFirstRgx() {
        BValue[] args = { new BString("abc is not abc as abc anymore"), new BString("[a-zA-Z]*bc"),
                new BString("xyz") };
        BValue[] returns = BRunUtil.invoke(result, "replaceFirstRgx", args);
        Assert.assertTrue(returns[0] instanceof BString);
        Assert.assertEquals(returns[0].stringValue(), "xyz is not abc as abc anymore");
    }
}
