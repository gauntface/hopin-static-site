const job = process.argv[2];

process.send({result: `basic-${job}`});