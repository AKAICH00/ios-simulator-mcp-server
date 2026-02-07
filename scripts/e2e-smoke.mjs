import { listDevices, bootDevice, shutdownDevice, listApps, takeScreenshot } from "../dist/services/simctl.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickTargetDevice(devices) {
  const available = devices.filter((d) => d.isAvailable);
  const booted = available.find((d) => d.state === "Booted");
  if (booted) return { device: booted, alreadyBooted: true };

  const shutdown = available.find((d) => d.state === "Shutdown");
  if (shutdown) return { device: shutdown, alreadyBooted: false };

  return null;
}

try {
  const devices = await listDevices();
  const target = pickTargetDevice(devices);

  if (!target) {
    console.error("No available simulators found to run e2e smoke test.");
    process.exit(1);
  }

  const { device, alreadyBooted } = target;

  if (!alreadyBooted) {
    console.log(`Booting simulator: ${device.name} (${device.udid})`);
    await bootDevice(device.udid);
    await sleep(3000);
  } else {
    console.log(`Using booted simulator: ${device.name} (${device.udid})`);
  }

  console.log("Listing installed apps...");
  try {
    const apps = await listApps(device.udid);
    console.log(`Found ${apps.length} apps.`);
  } catch (error) {
    console.warn("listApps failed; continuing smoke test.");
    console.warn(error);
  }

  const screenshotPath = `/tmp/mcp_e2e_${Date.now()}.png`;
  console.log(`Taking screenshot: ${screenshotPath}`);
  await takeScreenshot(device.udid, screenshotPath);

  if (!alreadyBooted) {
    console.log(`Shutting down simulator: ${device.udid}`);
    await shutdownDevice(device.udid);
  }

  console.log("E2E smoke test completed successfully.");
} catch (error) {
  console.error("E2E smoke test failed.");
  console.error(error);
  process.exit(1);
}
