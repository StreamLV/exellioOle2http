# exellioOle2http

Working with Exellio fiscal registrars with ole library and converting to http <br>

Enable nodejs scripts: <br>
    `Set-ExecutionPolicy RemoteSigned`

Install additional utils: <br>
    `npm install -g node-gyp`

To build win64 exe file you need pkg npm package, to install run: <br>
    `npm install -g pkg`

Build command: <br>
    `pkg app.js --targets win-x64 --output ./builds/build-win64/exellioOle2Http.exe`
