const job = process.argv[2];

setTimeout(() => {
    process.send({result: `second-delay-${job}`});
}, 1000);