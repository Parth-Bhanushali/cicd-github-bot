import { Probot } from "probot";
import { handlePreviewDeploymentsEvent } from './features/preview-deployments/index.js';

export default (app: Probot) => {
  app.on("issues.reopened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for reopening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on(["workflow_run.in_progress", "workflow_run.completed"], async (context) => {
    await handlePreviewDeploymentsEvent(context);
  })
};
