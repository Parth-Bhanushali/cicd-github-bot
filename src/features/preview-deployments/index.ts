import type { Context } from 'probot';
import { parseDeploymentTable, parseAppLinesFromWorkflowRun, generateDeploymentTable } from './utils.js';
import { checkWorkflowName, commentContainsDeploymentTable, wasCommentGeneratedByBot } from '../../lib/common.js';

/**
 * This function displays a table summarizing the applications deployed
 * during a pull request, providing relevant details about each deployment.
 * 
 * @param context of the workflow run event - in progress or completed
 * @returns Promise<void>
 */
export async function handlePreviewDeploymentsEvent(
  context: Context<'workflow_run.in_progress' | 'workflow_run.completed'>
) {
  const repo = context.payload.repository;
  const prNumber = context.payload.workflow_run.pull_requests[0]?.number;

  if (!prNumber) {
    return;
  }

  const workflowRun = context.payload.workflow_run;
  const isCDWorkflow = checkWorkflowName(workflowRun.path, 'cd.yml');

  if (!isCDWorkflow) {
    return;
  }

  const comments = await context.octokit.issues.listComments({
    owner: repo.owner.login,
    repo: repo.name,
    issue_number: prNumber,
  })

  const botComment = comments.data.find(comment =>
    wasCommentGeneratedByBot(comment.user?.login) &&
    commentContainsDeploymentTable(comment.body)
  );

  if (botComment?.body) {
    // Update the table
    const existingAppLines = parseDeploymentTable(botComment.body);
    const updatedAppLines = await parseAppLinesFromWorkflowRun(context, existingAppLines);
    const body = generateDeploymentTable(updatedAppLines);

    await context.octokit.issues.updateComment({
      owner: repo.owner.login,
      repo: repo.name,
      comment_id: botComment.id,
      body,
    })
  } else {
    // Create new table
    const appLines = await parseAppLinesFromWorkflowRun(context, []);

    if (appLines.length > 0) {
      const body = generateDeploymentTable(appLines);

      await context.octokit.issues.createComment({
        issue_number: prNumber,
        owner: repo.owner.login,
        repo: repo.name,
        body
      })
    }
  }
}