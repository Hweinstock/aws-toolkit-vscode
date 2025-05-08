/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import { adjustTextDiffForEditing, computeDiff } from '../output/computeDiff'
import { InlineTask, TextDiff } from './inlineTask'
import { InlineChatResult } from '@aws/language-server-runtimes-types'
import { InlineDecorator } from '../decorations/inlineDecorator'
import { getLogger } from 'aws-core-vscode/shared'
import { computeDecorations } from '../decorations/computeDecorations'
import { responseTransformer } from '../output/responseTransformer'

export async function applyDiff(
    task: InlineTask,
    textDiff: TextDiff[],
    undoOption?: { undoStopBefore: boolean; undoStopAfter: boolean }
) {
    const adjustedTextDiff = adjustTextDiffForEditing(textDiff)
    const visibleEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri === task.document.uri)
    const previousDiff = task.previouseDiff?.filter((diff) => diff.type === 'insertion')

    if (visibleEditor) {
        if (previousDiff) {
            await visibleEditor.edit(
                (editBuilder) => {
                    for (const insertion of previousDiff) {
                        editBuilder.delete(insertion.range)
                    }
                },
                { undoStopAfter: false, undoStopBefore: false }
            )
        }
        await visibleEditor.edit(
            (editBuilder) => {
                for (const change of adjustedTextDiff) {
                    if (change.type === 'insertion') {
                        editBuilder.insert(change.range.start, change.replacementText)
                    }
                }
            },
            undoOption ?? { undoStopBefore: true, undoStopAfter: false }
        )
    } else {
        if (previousDiff) {
            const edit = new vscode.WorkspaceEdit()
            for (const insertion of previousDiff) {
                edit.delete(task.document.uri, insertion.range)
            }
            await vscode.workspace.applyEdit(edit)
        }
        const edit = new vscode.WorkspaceEdit()
        for (const change of textDiff) {
            if (change.type === 'insertion') {
                edit.insert(task.document.uri, change.range.start, change.replacementText)
            }
        }
        await vscode.workspace.applyEdit(edit)
    }
}

export async function renderDiff(
    result: InlineChatResult,
    activeTask: InlineTask,
    decorator: InlineDecorator,
    isPartial: boolean
): Promise<boolean> {
    if (!result.body) {
        getLogger().warn('Recived empty body response, skipping diff')
        return false
    }
    const response = responseTransformer(result.body, activeTask, !isPartial, false)
    if (!response) {
        getLogger().warn('Recived empty response, skipping diff')
        return false
    }
    const textDiff = computeDiff(response, activeTask, isPartial)
    const decorations = computeDecorations(activeTask)
    activeTask.decorations = decorations
    await (isPartial
        ? applyDiff(activeTask, textDiff ?? [], { undoStopAfter: false, undoStopBefore: false })
        : applyDiff(activeTask, textDiff ?? []))
    decorator.applyDecorations(activeTask)
    activeTask.previouseDiff = textDiff
    return true
}
