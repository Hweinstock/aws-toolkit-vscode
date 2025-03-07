/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { getIcon } from '../../../../shared/icons'
import { TreeNode } from '../../../../shared/treeview/resourceTreeDataProvider'

export class PropertyNode implements TreeNode {
    public readonly id = this.key
    public readonly resource = this.value

    public constructor(
        private readonly key: string,
        private readonly value: unknown
    ) {}

    public async getChildren(): Promise<TreeNode[]> {
        if (this.value instanceof Array || this.value instanceof Object) {
            return generatePropertyNodes(this.value)
        } else {
            return []
        }
    }

    public getTreeItem() {
        const item = new vscode.TreeItem(`${this.key}: ${this.value}`)

        item.contextValue = 'awsAppBuilderPropertyNode'
        item.iconPath = getIcon('vscode-gear')

        if (this.value instanceof Array || this.value instanceof Object) {
            item.label = this.key
            item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
        }

        return item
    }
}

export function generatePropertyNodes(properties: { [key: string]: any }): TreeNode[] {
    return Object.entries(properties)
        .filter(([key, _]) => key !== 'Id' && key !== 'Type' && key !== 'Events')
        .map(([key, value]) => new PropertyNode(key, value))
}
