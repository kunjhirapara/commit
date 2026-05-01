import cron from "node-cron";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

function getHumanReadableTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

const backupDir = path.join(process.cwd(), "Backup");

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log("Database backup background job started.");
console.log("Scheduled to run every 24 hours at 00:00 timestamp.");

const twoMinsFromNow = new Date(Date.now() + 2 * 60 * 1000);
const minute = twoMinsFromNow.getMinutes();
const hour = twoMinsFromNow.getHours();

cron.schedule(`${minute} ${hour} * * *`, () => {
  console.log(
    `\n[${new Date().toISOString()}] Starting scheduled database backup...`,
  );

  const timestamp = getHumanReadableTimestamp();
  const filePath = path.join(backupDir, `db-backup-${timestamp}.zip`);

  const command = `npx convex export --path "${filePath}"`;

  console.log(`Executing: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Backup failed: ${error.message}`);
      return;
    }

    if (stderr && stderr.includes("Error")) {
      console.warn(`Backup stderr warnings: ${stderr}`);
    }

    console.log(`Backup completed successfully!`);
    console.log(`Saved to: ${filePath}`);
    if (stdout.trim()) console.log(`Output: \n${stdout.trim()}`);
  });
});
