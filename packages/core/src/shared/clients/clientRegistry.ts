/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import { ClientWrapper } from './client'

interface ClientKey {
    name: string
    region: string
}

export class AWSClientRegistry extends Map<ClientKey, ClientWrapper<any>> implements vscode.Disposable {
    public dispose(): void {
        this.forEach((client) => client.dispose())
        this.clear()
    }
}
