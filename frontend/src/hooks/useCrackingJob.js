import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export function useCrackingJob() {
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dependencies, setDependencies] = useState({});
  const pollInterval = useRef(null);

  const addLog = (message, type = 'INFO') => {
    setLogs(prev => [...prev.slice(-99), { timestamp: new Date().toLocaleTimeString(), message, type }]);
  };

  const checkDependencies = async () => {
    try {
      const res = await axios.get(`${API_BASE}/check-dependencies`);
      setDependencies(res.data.installed);
      return res.data.all_installed;
    } catch (err) {
      addLog('Failed to check dependencies', 'ERROR');
      return false;
    }
  };

  const installDependencies = async () => {
    setIsInstalling(true);
    addLog('Installing missing dependencies...', 'INFO');
    try {
      const res = await axios.post(`${API_BASE}/install-dependencies`);
      if (res.data.success) {
        addLog('Dependencies installed successfully', 'SUCCESS');
        await checkDependencies();
      } else {
        addLog(`Installation failed: ${res.data.message}`, 'ERROR');
      }
    } catch (err) {
      addLog('Error during installation', 'ERROR');
    } finally {
      setIsInstalling(false);
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    addLog(`Uploading ${file.name}...`, 'INFO');
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData);
      addLog(`${file.name} uploaded successfully`, 'SUCCESS');
      return res.data;
    } catch (err) {
      addLog(`Upload failed: ${err.response?.data?.error || err.message}`, 'ERROR');
      throw err;
    }
  };

  const startCrack = async (targetPath, wordlistPath, wordlistContent = '', maxWorkers = 8, source = 'uploaded') => {
    addLog(`Initializing recovery process using ${source} dataset...`, 'INFO');
    try {
      const res = await axios.post(`${API_BASE}/start-crack`, {
        target_path: targetPath,
        wordlist_path: wordlistPath,
        wordlist_content: wordlistContent,
        max_workers: maxWorkers,
        source: source
      });
      if (res.data.success) {
        setJob({ id: res.data.job_id, status: 'running', progress: 0, source: source });
        startPolling(res.data.job_id);
      }
    } catch (err) {
      addLog(`Failed to start: ${err.response?.data?.error || err.message}`, 'ERROR');
    }
  };

  const stopCrack = async () => {
    if (!job?.id) return;
    try {
      await axios.post(`${API_BASE}/stop-job/${job.id}`);
      addLog('Stopping process...', 'INFO');
    } catch (err) {
      addLog('Failed to stop job', 'ERROR');
    }
  };

  const startPolling = (jobId) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/job-status/${jobId}`);
        const data = res.data;
        setJob(data);

        if (data.status === 'completed') {
          addLog('Password Found!', 'SUCCESS');
          clearInterval(pollInterval.current);
        } else if (data.status === 'failed') {
          addLog(`Error: ${data.error}`, 'ERROR');
          clearInterval(pollInterval.current);
        } else if (data.status === 'stopped') {
          addLog('Process stopped by user', 'INFO');
          clearInterval(pollInterval.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  };

  useEffect(() => {
    checkDependencies();
    return () => clearInterval(pollInterval.current);
  }, []);

  return {
    job,
    logs,
    dependencies,
    isInstalling,
    installDependencies,
    uploadFile,
    startCrack,
    stopCrack,
    addLog
  };
}
