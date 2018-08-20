const job = process.argv[2];

setTimeout(() => {
    process.send(`second-delay-${job}`);
}, 1000);