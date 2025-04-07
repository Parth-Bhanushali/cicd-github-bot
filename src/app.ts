import { Probot } from "probot";
import { handlePreviewDeploymentsEvent } from './features/preview-deployments/index.js';

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on(["workflow_run.in_progress", "workflow_run.completed"], async (context) => {
    await handlePreviewDeploymentsEvent(context);
  })
};
