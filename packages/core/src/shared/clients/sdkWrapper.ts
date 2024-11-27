/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import { globals } from '..'
import { AwsClient, AwsClientConstructor } from '../awsClientBuilderV3'

export abstract class SDKWrapper<T extends AwsClient> implements vscode.Disposable {
    protected client: T | undefined

    private constructor(
        public readonly regionCode: string,
        private readonly clientType: AwsClientConstructor<T>
    ) {}

    protected async getClient(): Promise<T> {
        if (this.client) {
            return this.client
        }
        this.client = await globals.sdkClientBuilderV3.createAwsService(this.clientType, undefined, this.regionCode)
        return this.client
    }

    public dispose() {
        this.client?.destroy()
    }
}
