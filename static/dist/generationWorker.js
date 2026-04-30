// Generation Worker for Advanced Wordlist Logic
let isPaused = false;
let stopRequested = false;

self.onmessage = function(e) {
  const { action, config } = e.data;

  if (action === 'start') {
    stopRequested = false;
    isPaused = false;
    generate(config);
  } else if (action === 'mutate') {
    stopRequested = false;
    isPaused = false;
    smartMutate(config);
  } else if (action === 'pause') {
    isPaused = true;
  } else if (action === 'resume') {
    isPaused = false;
  } else if (action === 'stop') {
    stopRequested = true;
  }
};

const isValid = (pw, config) => {
  const { require_letter, require_number, max_repeat, max_consecutive, no_sequential } = config;
  
  if (require_letter && !/[a-zA-Z]/.test(pw)) return false;
  if (require_number && !/\d/.test(pw)) return false;
  
  const maxRep = parseInt(max_repeat);
  if (!isNaN(maxRep) && maxRep > 0) {
    const counts = {};
    for (const char of pw) {
      counts[char] = (counts[char] || 0) + 1;
      if (counts[char] > maxRep) return false;
    }
  } else if (maxRep === 0) return false;

  const maxCons = parseInt(max_consecutive);
  if (!isNaN(maxCons) && maxCons > 0) {
    let cons = 1;
    for (let i = 1; i < pw.length; i++) {
      if (pw[i] === pw[i-1]) {
        cons++;
        if (cons > maxCons) return false;
      } else {
        cons = 1;
      }
    }
  }

  if (no_sequential) {
    for (let i = 2; i < pw.length; i++) {
      const v1 = pw.charCodeAt(i-2), v2 = pw.charCodeAt(i-1), v3 = pw.charCodeAt(i);
      if ((v2 === v1 + 1 && v3 === v2 + 1) || (v2 === v1 - 1 && v3 === v2 - 1)) return false;
    }
  }

  return true;
};

async function generate(config) {
  const { charset, min_len, max_len, limit, mode, pattern_string, custom_charset } = config;
  let count = 0;
  let batch = [];
  const startTime = Date.now();
  let lastUpdate = 0;

  if (mode === 'pattern' && pattern_string) {
    const patterns = pattern_string.split(/[\n,]/).map(p => p.trim()).filter(p => p);
    const entropy = (custom_charset || "").split('');
    const digits = "0123456789".split('');
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    const lower = "abcdefghijklmnopqrstuvwxyz".split('');

    for (const pattern of patterns) {
      if (stopRequested) return;

      const generateRecursive = async (template) => {
        if (stopRequested) return;
        if (limit && count >= limit) return;

        // Search for the first placeholder: X, A, a, or *
        // We use a specific search to find the first occurrence of these specific characters
        const placeholderIdx = template.search(/[XAa*]/);
        
        if (placeholderIdx === -1) {
          if (isValid(template, config)) {
            batch.push(template);
            count++;
          }
          return;
        }

        const charType = template[placeholderIdx];
        let pool = [];
        if (charType === 'X') pool = digits;
        else if (charType === 'A') pool = upper;
        else if (charType === 'a') pool = lower;
        else if (charType === '*') {
          pool = entropy.length > 0 ? entropy : [""]; 
        }

        for (const c of pool) {
          if (stopRequested) return;
          const nextTemplate = template.slice(0, placeholderIdx) + c + template.slice(placeholderIdx + 1);
          await generateRecursive(nextTemplate);
          
          if (count % 250 === 0 && Date.now() - lastUpdate > 300) {
            self.postMessage({ action: 'progress', count, speed: Math.floor(count / ((Date.now() - startTime) / 1000)) });
            lastUpdate = Date.now();
            await new Promise(res => setTimeout(res, 0));
          }
          if (limit && count >= limit) break;
        }
      };

      await generateRecursive(pattern);
      if (limit && count >= limit) break;
    }
  } else {
    const chars = (custom_charset || charset || "abcdefghijklmnopqrstuvwxyz0123456789").split('');
    function* product(chars, repeat) {
      const n = chars.length;
      const indices = new Array(repeat).fill(0);
      yield indices.map(i => chars[i]).join('');
      while (true) {
        let i;
        for (i = repeat - 1; i >= 0; i--) { if (indices[i] !== n - 1) break; }
        if (i === -1) return;
        indices[i]++;
        for (let j = i + 1; j < repeat; j++) indices[j] = 0;
        yield indices.map(idx => chars[idx]).join('');
      }
    }

    for (let r = min_len; r <= max_len; r++) {
      const generator = product(chars, r);
      for (const combo of generator) {
        while (isPaused && !stopRequested) await new Promise(res => setTimeout(res, 100));
        if (stopRequested) return;

        if (isValid(combo, config)) {
          batch.push(combo);
          count++;
        }

        if (count % 1000 === 0 || Date.now() - lastUpdate > 500) {
          const elapsed = (Date.now() - startTime) / 1000;
          self.postMessage({ action: 'progress', count, speed: Math.floor(count / elapsed) });
          lastUpdate = Date.now();
          await new Promise(res => setTimeout(res, 0));
        }
        if (limit && count >= limit) break;
      }
      if (limit && count >= limit) break;
    }
  }
  self.postMessage({ action: 'complete', count, content: batch.join('\n') });
}

async function smartMutate(config) {
  const { seed, limit } = config;
  if (!seed) return;

  const results = new Set();
  const word = seed.match(/[a-zA-Z]+/g)?.[0] || "";
  const symbols = seed.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g)?.[0] || "";
  const numbers = seed.match(/\d+/g)?.[0] || "";

  const variations = [
    seed,
    word + symbols + numbers,
    word + numbers + symbols,
    symbols + word + numbers,
    numbers + word + symbols,
    word.toLowerCase() + symbols + numbers,
    word.toUpperCase() + symbols + numbers,
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + symbols + numbers,
  ];

  // Add more dynamic patterns
  for (let i = 0; i < 100; i++) {
    const randNum = Math.floor(Math.random() * Math.pow(10, numbers.length)).toString().padStart(numbers.length, '0');
    variations.push(word + symbols + randNum);
    variations.push(word + randNum + symbols);
    if (results.size > (limit || 10000)) break;
  }

  variations.forEach(v => {
    if (isValid(v, config)) results.add(v);
  });

  self.postMessage({ action: 'complete', count: results.size, content: Array.from(results).join('\n') });
}
