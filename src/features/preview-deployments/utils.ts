import type { Context } from 'probot';

enum AppStatus {
  IN_PROGRESS = "⏳ In Progress",
  SUCCESS = "✅ Successful",
  FAILED = "❌ Failed",
  SKIPPED = "🚫 Skipped",
  CANCELLED = "⛔ Cancelled",
  NEUTRAL = "➖ Neutral",
}

interface AppStatusLine {
  name: string;
  status: AppStatus;
  jobUrl: string;
  updatedAt: string;
  previewLink: string | string[];
}

function parsePreviewLinksFromLogs(data: string): string | string[] {
  const regex = /deploy_url=(https:\/\/[^\s\)\"]+)/g;
  const matches = [...data.matchAll(regex)].map(match => match[1].replace(/\x1b\[[0-9;]*m/g, ''));
  if (!matches?.length) {
    return '#';
  }

  // From the logs data, the same urls are being matched multiple times,
  // so duplicates needs to be removed before using.
  return matches.length === 1 ? matches[0] : [...new Set(matches)];
}

function parseLinksFromTableColumn(markdownColumnStr: string) {
  const regex = /(https:\/\/[^\s\)\"]+)/g;
  const match = markdownColumnStr.match(regex);
  if (!match?.length) {
    return '#'
  } else if (match.length === 1) {
    return match[0];
  }
  return match;
}

export function generateDeploymentTable(apps: AppStatusLine[]) {
  let table = `### Deployment Status\n\n` +
    `| Number | App Name         | Preview Links | Status | Last update |\n` +
    `|--------|------------------|---------------|--------|-------------|\n`;
  apps.forEach((app, index) => {
    const numberColumnData = index + 1;
    const appNameColumnData = app.name;

    let previewLinksColumnData;
    if (typeof app.previewLink === 'object') {
      previewLinksColumnData = app.previewLink.map(link => `[Preview deployment](${link})`).join(' ');
    } else {
      previewLinksColumnData = `[Preview deployment](${app.previewLink})`;
    }

    const statusColumnData = `${app.status} ([Logs](${app.jobUrl}))`;
    const lastUpdateColumnData = app.updatedAt;
    table += `| ${numberColumnData} | ${appNameColumnData} | ${previewLinksColumnData} | ${statusColumnData} | ${lastUpdateColumnData} |\n`;
  });
  return table;
}

export function parseDeploymentTable(markdown: string): AppStatusLine[] {
  // Split the markdown lines
  const lines = markdown.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Find the index of separator line
  const separatorIndex = lines.findIndex(line => line.startsWith('|--') && line.endsWith('--|'));

  // Extract the data lines after separator line
  const dataLines = lines.slice(separatorIndex + 1);

  const apps: AppStatusLine[] = dataLines.map(line => {
    const columns = line.split('|').map(col => col.trim()).filter(col => col.length > 0);

    const name = columns[1];
    const previewColumn = columns[2];
    const previewLink = parseLinksFromTableColumn(previewColumn);
    const statusColumn = columns[3];
    const status = statusColumn.slice(0, statusColumn.indexOf('(')).trim() as AppStatus;
    const jobUrl = statusColumn.slice(statusColumn.lastIndexOf('(') + 1, statusColumn.indexOf(')'));
    const updatedAt = columns[4];

    return {
      name,
      status,
      jobUrl,
      updatedAt,
      previewLink,
    };
  })

  return apps;
}

export async function parseAppLinesFromWorkflowRun(
  context: Context<'workflow_run.in_progress'> | Context<'workflow_run.completed'>,
  existingAppLines: AppStatusLine[],
): Promise<AppStatusLine[]> {
  const repo = context.payload.repository;
  const workflowRun = context.payload.workflow_run;
  const appLines: AppStatusLine[] = [...existingAppLines];

  const jobs = await context.octokit.actions.listJobsForWorkflowRun({
    owner: repo.owner.login,
    repo: repo.name,
    run_id: workflowRun.id,
  });

  for (const job of jobs.data.jobs) {
    let pattern = /^Deploy (\S+)/;
    const match = job.name.match(pattern);
    let previewLink: string | string[] = '#';

    if (match) {
      const appName = match[1];
      let status: AppStatus | null;
      switch (job.conclusion) {
        case 'success':
          status = AppStatus.SUCCESS
          break;
        case 'failure':
        case 'action_required':
        case 'timed_out':
          status = AppStatus.FAILED
          break;
        case 'skipped':
          status = AppStatus.SKIPPED
          break;
        case 'cancelled':
          status = AppStatus.CANCELLED
          break;
        case 'neutral':
          status = AppStatus.NEUTRAL
          break;
        default:
          status = AppStatus.IN_PROGRESS;
      }

      if (status === AppStatus.SKIPPED) {
        continue;
      } else if (status === AppStatus.SUCCESS) {
        const jobLogsData = await context.octokit.actions.downloadJobLogsForWorkflowRun({
          owner: repo.owner.login,
          repo: repo.name,
          job_id: job.id
        })
        const logs = jobLogsData.data;
        if (typeof logs === 'string') {
          previewLink = parsePreviewLinksFromLogs(logs);
        }
      }

      let appLine = existingAppLines.find(line => line.name === appName);
      const jobUrl = job.html_url ?? '#';
      const updatedAt = new Date().toISOString();
      if (!appLine) {
        appLine = {
          name: appName,
          status,
          updatedAt,
          jobUrl,
          previewLink,
        }
        appLines.push(appLine);
      } else {
        appLine.status = status;
        appLine.updatedAt = updatedAt;
        appLine.jobUrl = jobUrl;
        appLine.previewLink = previewLink;
      }
    }
  }

  return appLines.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
