/**
 * Gerador de Alarme Sonoro Industrial via Web Audio API
 * Não depende de arquivos MP3 externos; roda nativamente no navegador.
 * Frequências ergonômicas de alerta tipo torre: 880 Hz alternado com 660 Hz.
 */

let audioCtx = null;
let somHabilitado = true;

export const soundAlert = {
  toggleSom(ativo) {
    somHabilitado = ativo !== undefined ? ativo : !somHabilitado;
    return somHabilitado;
  },

  isHabilitado() {
    return somHabilitado;
  },

  tocarAlarmeEmergencia() {
    if (!somHabilitado) return;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const agora = audioCtx.currentTime;

      // Primeiro tom: 880 Hz (A5 - Agudo de Alerta)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, agora);
      gain1.gain.setValueAtTime(0.15, agora);
      gain1.gain.exponentialRampToValueAtTime(0.01, agora + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(agora);
      osc1.stop(agora + 0.25);

      // Segundo tom: 660 Hz (E5 - Confirmação de Torre)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(660, agora + 0.28);
      gain2.gain.setValueAtTime(0.15, agora + 0.28);
      gain2.gain.exponentialRampToValueAtTime(0.01, agora + 0.55);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(agora + 0.28);
      osc2.stop(agora + 0.55);
    } catch (e) {
      console.warn('[Audio Alert] Navegador bloqueou reprodução de áudio:', e);
    }
  }
};

export const playTowerAlarm = () => soundAlert.tocarAlarmeEmergencia();
