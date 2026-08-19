const fs = require('fs');
let content = fs.readFileSync('src/components/LiteApp.tsx', 'utf8');

// 1. Update error message in error panel
const oldErrorMsg = `Stream unavailable: All manifest tracks exhausted for this channel.`;
const newErrorMsg = `\${playerStore.error?.message || "Stream unavailable: All manifest tracks exhausted for this channel."}`;

if (content.includes(oldErrorMsg)) {
  content = content.replace(oldErrorMsg, newErrorMsg);
  console.log("Successfully replaced error message text.");
} else {
  console.error("Could not find old error message text!");
}

// 2. Update onError callback
const oldOnError = `                          onError={(msg) => {
                            const currentCh = channels.find(ch => ch.url === currentUrl);
                            if (currentCh && currentCh.name === "AJN Live") {
                              const vodUrl = generateDayWindow("AJN Hourly", new Date())[0];
                              if (vodUrl) {
                                playStream(vodUrl, "AJN Hourly (Live Fallback)");
                                addLog(\`[Fallback] Rumble embed failed (\${msg}). Falling back to VOD: \${vodUrl}\`);
                              }
                            }
                          }}`;

const newOnError = `                          onError={(msg) => {
                            const currentCh = channels.find(ch => ch.url === currentUrl);
                            const vodUrl = currentCh && currentCh.name === "AJN Live"
                              ? generateDayWindow("AJN Hourly", new Date())[0]
                              : undefined;
                            if (vodUrl) {
                              playStream(vodUrl, "AJN Hourly (Live Fallback)");
                              addLog(\`[Fallback] Rumble embed failed (\${msg}). Falling back to VOD: \${vodUrl}\`);
                            } else {
                              const errMsg = msg || "Unknown playback failure";
                              addLog(\`[SmartVideoEngine] Playback failed for "\${currentTitle}": \${errMsg}\`, "error");
                              setPlayerStore(prev => ({
                                ...prev,
                                state: "error",
                                error: { code: "PLAYBACK_FAILED", message: errMsg }
                              }));
                            }
                          }}`;

if (content.includes('if (currentCh && currentCh.name === "AJN Live") {')) {
  content = content.replace(
    `                          onError={(msg) => {
                            const currentCh = channels.find(ch => ch.url === currentUrl);
                            if (currentCh && currentCh.name === "AJN Live") {
                              const vodUrl = generateDayWindow("AJN Hourly", new Date())[0];
                              if (vodUrl) {
                                playStream(vodUrl, "AJN Hourly (Live Fallback)");
                                addLog(\`[Fallback] Rumble embed failed (\${msg}). Falling back to VOD: \${vodUrl}\`);
                              }
                            }
                          }}`,
    newOnError
  );
  console.log("Successfully replaced onError callback.");
} else {
  console.error("Could not find old onError callback!");
}

fs.writeFileSync('src/components/LiteApp.tsx', content, 'utf8');
console.log("LiteApp.tsx patched successfully.");
