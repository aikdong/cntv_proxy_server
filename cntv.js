var express = require('express');
var app = express();
var fs = require('fs');

var address = '10.0.1.201';
var proxy = 8002;
var regex = /\/([^\.]+)\.mp4/i;
var urlpattern = /^http:\/\//i;

var m3u8 = function (req, res) {
  fs.readFile(
    '/volume1/web/cntv/channels.txt', {'encoding': 'utf-8','flag': 'r'},
    function(err, data) {
    	var html = data.toString();
      html = html.replace(/{hostname}/g, address);
      html = html.replace(/{port}/g, proxy);

      res.send(html);
    }
	);
}

// 输出m3u8列表文件
app.get('/', m3u8);
app.get('/*.m3u8', m3u8);

app.get('/*.mp4', function (req, res) {
  var channel = req.url.match(regex)[1];

  var options = {
		hostname: 'vdn.live.cntv.cn',
    port: 80,
    path: '/api2/liveHtml5.do?client=html5&channel=pa://cctv_p2p_hd' + channel,
		method: 'GET'
	};
	var request = require('http').request(options, function (response) {
    response.setEncoding('utf8');
    var buffer = '';
    response.on('data', function(chunk) {
        buffer += chunk;
    });
    response.on('error', function (evt) {
	    res.status(500).send({ error: evt.message });
      console.log(evt.message);
    });
    response.on('end', function() {
      var startIndex = buffer.indexOf('{');
      var endIndex = buffer.lastIndexOf('}');
      var jsonStr = buffer.substring(startIndex, endIndex+1);
      var obj = JSON.parse(jsonStr);
      if (obj['ack'] == 'yes') {
          var urls = obj['hls_url'];
          if (urls) {
              for (var key in urls) {
                  var url = urls[key];
                  if (urlpattern.test(url)) {
                    // 302 redirect
                    res.redirect(url);
                  }
                  break;
              }
          }
      }else{
          res.status(500).send({ error: buffer });
          console.log(buffer);
      }
    });
  });
  request.on('error', function (evt) {
    res.status(500).send({ error: evt.message });
    console.log(evt.message);
  });
	request.end();
});

var server = app.listen(proxy, function () {
  var host = server.address().address;
  var port = server.address().port;

  fs.writeFile("/tmp/cntv.pid", process.pid);
  console.log('CNTV proxy running at http://%s:%s and pid write to /tmp/cntv.pid %d', address, port, process.pid);
  
});