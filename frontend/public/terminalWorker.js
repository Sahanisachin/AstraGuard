// Terminal Log Worker
// Simulates the cracking process logs off-main-thread

self.onmessage = (e) => {
    const { wordlist, isRunning, batchSize = 10 } = e.data;
    
    if (!isRunning) return;

    let currentIndex = 0;
    const simulatedPasswords = wordlist && wordlist.length > 0 
        ? wordlist 
        : ['admin', '123456', 'password', 'qwerty', 'root', 'secret', 'welcome'];

    const process = async () => {
        while (currentIndex < simulatedPasswords.length) {
            const batch = [];
            for (let i = 0; i < batchSize && currentIndex < simulatedPasswords.length; i++) {
                const pw = simulatedPasswords[currentIndex % simulatedPasswords.length];
                batch.push({
                    timestamp: new Date().toLocaleTimeString(),
                    message: `CHECK_VECTOR: ${pw}${Math.floor(Math.random() * 1000)}`,
                    type: 'TRY',
                    index: currentIndex
                });
                currentIndex++;
            }

            self.postMessage({ type: 'BATCH', batch, total: simulatedPasswords.length, current: currentIndex });
            
            // Yield to UI thread/limit speed
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // If the wordlist is huge, we might want to loop forever or stop
            if (currentIndex >= simulatedPasswords.length && wordlist && wordlist.length > 0) break;
            if (currentIndex >= simulatedPasswords.length) currentIndex = 0; // Loop simulation for default list
        }
    };

    process();
};
