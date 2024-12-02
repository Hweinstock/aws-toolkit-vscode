/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import globals from '../extensionGlobals'
import { AwsClient, AwsClientConstructor } from '../awsClientBuilderV3'

export abstract class ClientWrapper<C extends AwsClient> implements vscode.Disposable {
    protected client: C | undefined

    public constructor(
        public readonly regionCode: string,
        private readonly clientType: AwsClientConstructor<any>
    ) {}

    protected async getClient() {
        if (this.client) {
            return this.client
        }
        this.client = await globals.sdkClientBuilderV3.createAwsService(this.clientType, undefined, this.regionCode)
        return this.client!
    }

    public dispose() {
        this.client?.destroy()
    }
}
