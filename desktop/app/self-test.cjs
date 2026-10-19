const { app, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

// Explicit opt-in QA mode. It never runs during normal launches.
async function runSelfTest(window) {
  const output = process.env.VESPER_TEST_OUTPUT;
  if (!output || !path.isAbsolute(output)) throw new Error('An absolute test output directory is required.');
  await fs.mkdir(output, { recursive: true });
  const failures = [];
  window.webContents.on('render-process-gone', (_event, detail) => failures.push(detail.reason));
  // Prove the packaged interface and local audio work without any network access.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  const timeout = setTimeout(() => { console.error('Desktop self-test timed out'); app.exit(1); }, 35000);
  try {
    await window.loadURL('vesper://app/');
    const initial = await window.webContents.executeJavaScript(`(async () => {
      const wait = async (condition) => { for(let i=0;i<100;i++) { if(condition()) return; await new Promise(r=>setTimeout(r,50)); } throw new Error('UI did not become ready'); };
      await wait(()=>document.querySelector('.library-nav'));
      const button = [...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('本地与原创'));
      button.click();
      await wait(()=>document.querySelector('.queue-list button')?.textContent.includes('Canticle'));
      document.querySelector('.queue-list button').click();
      await wait(()=>document.querySelector('h1')?.textContent==='Canticle of Ash' && document.querySelector('audio').readyState>=1 && Number.isFinite(document.querySelector('audio').duration));
      return {title:document.title,offlineLocalTracks:document.querySelectorAll('.queue-list button').length,duration:document.querySelector('audio').duration,backgroundLoaded:document.querySelector('.cinema-background').naturalWidth>0,nodeUnavailable:typeof require==='undefined'};
    })()`);
    const playback = await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('button[aria-label="Play"]').click();
      for(let i=0;i<100;i++) { if(document.querySelector('audio').currentTime>.5 && Number(document.querySelector('.turntable').style.getPropertyValue('--audio-energy'))>0) break; await new Promise(r=>setTimeout(r,50)); }
      const audio=document.querySelector('audio');
      const result={playing:!audio.paused,time:audio.currentTime,energy:Number(document.querySelector('.turntable').style.getPropertyValue('--audio-energy'))};
      audio.currentTime=10;
      await new Promise(r=>setTimeout(r,250));
      result.seek=audio.currentTime>=10;
      document.querySelector('button[aria-label="Pause"]').click();
      await new Promise(r=>setTimeout(r,150));
      result.paused=audio.paused;
      result.pauseEnergy=Number(document.querySelector('.turntable').style.getPropertyValue('--audio-energy'));
      return result;
    })()`, true);
    const imported = await window.webContents.executeJavaScript(`(async () => {
      const response=await fetch('/audio/canticle-of-ash.wav');
      const data=new DataTransfer();
      data.items.add(new File([await response.blob()], '本地导入测试.wav', {type:'audio/wav'}));
      const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      for(let i=0;i<100;i++) { if(document.querySelector('h1')?.textContent==='本地导入测试'&&document.querySelector('audio').readyState>=1) break; await new Promise(r=>setTimeout(r,50)); }
      return {title:document.querySelector('h1')?.textContent,blobSource:document.querySelector('audio').src.startsWith('blob:'),duration:document.querySelector('audio').duration};
    })()`);
    await fs.writeFile(path.join(output, 'desktop.png'), (await window.capturePage()).toPNG());
    const report = { packaged: app.isPackaged, version: app.getVersion(), initial, playback, imported, failures };
    const passed = initial.offlineLocalTracks===3 && Number.isFinite(initial.duration) && initial.duration>10 && initial.backgroundLoaded && initial.nodeUnavailable && playback.playing && playback.time>.5 && playback.energy>0 && playback.seek && playback.paused && playback.pauseEnergy===0 && imported.title==='本地导入测试' && imported.blobSource && Number.isFinite(imported.duration) && imported.duration>10 && failures.length===0;
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({...report,passed},null,2));
    console.log(JSON.stringify({...report,passed}));
    app.exit(passed?0:1);
  } catch (error) {
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.message},null,2));
    console.error(error.message); app.exit(1);
  } finally { clearTimeout(timeout); }
}
module.exports = { runSelfTest };
