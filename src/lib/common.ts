import fs from 'fs';
import path from 'path';

import { botName } from './const.js';

export function commentContainsDeploymentTable(commentBody: string = ''): boolean {
  return commentBody.includes('### Deployment Status');
}

export function wasCommentGeneratedByBot(login: string | undefined): boolean {
  return login === `${botName}[bot]`;
}

export function checkWorkflowName(path: string = '', workflowName: string) {
  const split = path.split('/');
  return split[split.length - 1] === workflowName;
}

/** 
 * A function to log any objects to a log file
 */ 
export function logToFile(data: any, fileName = 'output') {
  // Convert the data to a string (JSON format in this case)
  const dataToSave = JSON.stringify(data, null, 2);

  // Get the current working directory
  const cwd = process.cwd();

  // Specify the full file path in the current working directory
  const filePath = path.join(cwd, `.logs/${fileName}.txt`);

  // Write the data to the file
  fs.writeFile(filePath, dataToSave, (err: any) => {
    if (err) {
      console.error('Error saving file:', err);
    } else {
      console.log(`File saved successfully at ${filePath}`);
    }
  });
}