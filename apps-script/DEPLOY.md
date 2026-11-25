# Deploy the Santos Leads call-log web app (about 5 minutes, one time)

Do this signed in as **santosoptical@gmail.com** (the Sheet owner).

1. Open the Sheet "Santos Optical Leads" → **Extensions → Apps Script**.
2. Delete what is in `Code.gs`, paste the whole `Code.gs` from this folder, and click **Save** (💾).
3. In the function dropdown at the top pick **setupKey** → **Run**. Approve the permission prompt
   (Advanced → Go to project → Allow). Open **Execution log**: copy the key it prints.
4. **Deploy → New deployment** → gear ⚙ → **Web app**.
   - Description: Santos Leads call log
   - Execute as: **Me (santosoptical@gmail.com)**
   - Who has access: **Anyone**
   → **Deploy** → copy the **Web app URL** (ends in `/exec`).
5. On each phone open https://biensantos9241.github.io/santos-leads/ → **⚙ Sync setup** → paste the URL and the key → Save.
   The page then reads live leads from the web app (no more "Demo mode") and uploads saved call logs.

Notes
- The key is stored only in Script Properties and on each phone. It is never put on GitHub.
  Anyone without the key gets `{"ok":false,"error":"bad key"}`.
- After changing Code.gs later: Deploy → **Manage deployments** → ✏️ → Version: *New version* → Deploy (the URL stays the same).
- To change the key: Project Settings → Script Properties → delete SANTOS_KEY → run setupKey again → update phones.
- The web app never deletes a row. "Remove from list" only sets Status = Removed (and logs who/when); "Restore" sets Status = Restored.
