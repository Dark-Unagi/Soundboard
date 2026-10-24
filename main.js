let data = { groups: [], currentGroup: null };
let pendingDeleteId = null;
let selectedGroupForOptions = null;
let selectedSoundForOptions = null;
let db;
let wakeLock = null;


async function enableWakeLock() {

    try {

        wakeLock =
            await navigator.wakeLock.request("screen");

        document.getElementById("wakeLockBtn").textContent = "🔒 Awake ON";
        document.getElementById("wakeLockBtn").classList.remove("bg-gray-700");
        document.getElementById("wakeLockBtn").classList.add("bg-green-600");

    } catch (err) {
        console.error("Wake Lock failed", err);

        alert(
            "Wake Lock not supported on this browser."
        );
    }
}

async function disableWakeLock() {

    if (!wakeLock) return;

    await wakeLock.release();

    wakeLock = null;

    document.getElementById("wakeLockBtn").textContent = "🔓 Awake OFF";
    document.getElementById("wakeLockBtn").classList.remove("bg-green-600");
    document.getElementById("wakeLockBtn").classList.add("bg-gray-700");
}

async function toggleWakeLock() {

    if (wakeLock) {

        await disableWakeLock();

    } else {

        await enableWakeLock();

    }
}

document.addEventListener("visibilitychange", async () => {

    if (
        wakeLock &&
        document.visibilityState === "visible"
    ) {

        await enableWakeLock();
    }
}
);

/* ---------------------------------------------------------
   IndexedDB
--------------------------------------------------------- */
async function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open("SoundboardDB", 1);
        request.onerror =
            () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("appData")) {
                db.createObjectStore(
                    "appData",
                    {
                        keyPath: "id"
                    }
                );
            }
        };
    });
}

async function saveData() {
    if (!db) return;

    const tx =
        db.transaction(["appData"], "readwrite"
        );

    const store = tx.objectStore("appData");

    const cleanedData = structuredClone(data);

    cleanedData.groups.forEach(group => {

        group.sounds.forEach(sound => {
            delete sound.audio;
            delete sound.playing;
            delete sound.file;
        });
    });

    store.put({
        id: "soundboard", data: cleanedData
    });
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
    });
}

async function loadData() {
    if (!db) return;
    const tx = db.transaction(["appData"], "readonly"
    );

    const store = tx.objectStore("appData");

    const request = store.get("soundboard");

    request.onsuccess = () => {

        if (!request.result) return;

        data = request.result.data;

        data.groups.forEach(group => {

            group.sounds.forEach(sound => {

                sound.audio = null;
                sound.playing = false;

                if (sound.fileData) {

                    sound.file =
                        URL.createObjectURL(
                            sound.fileData
                        );
                }
            });
        });

        if (
            data.currentGroup &&
            !data.groups.some(
                g => g.id === data.currentGroup
            )
        ) {

            data.currentGroup = null;
        }

        renderGroups();
        renderSounds();
    };
}

/* ---------------------------------------------------------
   GROUP MANAGEMENT
--------------------------------------------------------- */
function addGroup() {
    const input = document.getElementById("newGroupName");
    const name = input.value.trim();
    if (!name) return;

    const group = {
        id: "group_" + Date.now(),
        name,
        sounds: [],
        color: "bg-gray-700"
    };

    data.groups.push(group);
    data.currentGroup = group.id;

    input.value = ""; // CLEAR INPUT

    renderGroups();
    renderSounds();
    saveData();
}

function deleteSelectedGroup() {
    const groupToDelete =
        data.groups.find(
            g => g.id === selectedGroupForOptions
        );

    if (groupToDelete) {

        groupToDelete.sounds.forEach(sound => {

            if (sound.file) {
                URL.revokeObjectURL(sound.file);
            }

        });
    }

    data.groups =
        data.groups.filter(
            g => g.id !== selectedGroupForOptions
        );
    if (data.currentGroup === selectedGroupForOptions) {

        data.currentGroup = null;
    }

    closeGroupOptions();
    renderGroups();
    renderSounds();
    saveData();
}

function renderGroups() {
    const container = document.getElementById("groupButtons");
    container.innerHTML = "";

    data.groups.forEach(group => {
        const btn = document.createElement("button");
        btn.className =
            `w-40 h-12 rounded-lg font-semibold text-white transition-all ${group.color} ` +
            (data.currentGroup === group.id
                ? "ring-4 ring-blue-400"
                : "");

        btn.textContent = group.name;

        btn.onclick = () => {
            data.currentGroup = group.id;
            renderGroups();
            renderSounds();
        };

        // LONG PRESS FOR OPTIONS
        let pressTimer;
        btn.addEventListener("mousedown", () => {
            pressTimer = setTimeout(() => {
                openGroupOptions(group.id);
            }, 600);
        });
        btn.addEventListener("mouseup", () => clearTimeout(pressTimer));
        btn.addEventListener("mouseleave", () => clearTimeout(pressTimer));

        container.appendChild(btn);
    });
}

/* ---------------------------------------------------------
   GROUP OPTIONS MODAL
--------------------------------------------------------- */
function openGroupOptions(groupId) {
    selectedGroupForOptions = groupId;

    const modal = document.getElementById("groupOptionsModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const colors = [
        { class: "bg-red-600" },
        { class: "bg-green-600" },
        { class: "bg-lime-500" },
        { class: "bg-blue-600" },
        { class: "bg-teal-500" },
        { class: "bg-yellow-500" },
        { class: "bg-orange-500" },
        { class: "bg-indigo-500" },
        { class: "bg-purple-600" }
    ];

    const container =
        document.getElementById("colorOptions");
    container.innerHTML = "";

    const group = data.groups.find(g => g.id === groupId);

    if (!group) return;

    const renameInput = document.getElementById("groupRenameInput");
    renameInput.value = group.name;

    document.getElementById("renameGroupBtn").onclick = () => {

        const newName = renameInput.value.trim();

        if (!newName) return;
        group.name = newName;

        renderGroups();
        saveData();
    };

    colors.forEach(color => {

        const circle = document.createElement("div");

        circle.className =
            `${color.class} w-10 h-10 rounded-full cursor-pointer transition-all`;

        if (group.color === color.class) {

            circle.classList.add("ring-4", "ring-white");
        }

        circle.onclick = () => {
            group.color = color.class;

            renderGroups();
            saveData();
            openGroupOptions(groupId);
        };

        container.appendChild(circle);
    });
}

function closeGroupOptions() {

    const modal = document.getElementById("groupOptionsModal");

    modal.classList.remove("flex");
    modal.classList.add("hidden");
}

/* ---------------------------------------------------------
   SOUND OPTIONS MODAL
--------------------------------------------------------- */

function openSoundOptions(sound) {

    selectedSoundForOptions = sound;

    const modal = document.getElementById("soundOptionsModal");

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    const colors = [
        "bg-red-600",
        "bg-green-600",
        "bg-lime-500",
        "bg-blue-600",
        "bg-teal-500",
        "bg-yellow-500",
        "bg-orange-500",
        "bg-indigo-500",
        "bg-purple-600"
    ];

    const container =
        document.getElementById("soundColorOptions");

    container.innerHTML = "";

    colors.forEach(color => {

        const circle = document.createElement("div");

        circle.className =
            `${color} w-10 h-10 rounded-full cursor-pointer`;

        if (sound.color === color) {
            circle.classList.add("ring-4", "ring-white");
        }

        circle.onclick = () => {
            sound.color = color;
            renderSounds();
            saveData();
            openSoundOptions(sound);
        };

        container.appendChild(circle);
    });

    const loopBtn =
        document.getElementById("soundLoopBtn");

    updateToggleStyle(loopBtn, sound.loop);

    loopBtn.onclick = () => {
        sound.loop = !sound.loop;
        saveData();
        updateToggleStyle(loopBtn, sound.loop);
    };

    const fadeBtn =
        document.getElementById("soundFadeBtn");

    updateToggleStyle(fadeBtn, sound.fading);

    fadeBtn.onclick = () => {
        sound.fading = !sound.fading;
        saveData();
        updateToggleStyle(fadeBtn, sound.fading);
    };

    const slider =
        document.getElementById("soundVolumeSlider");

    slider.value = sound.volume;

    slider.oninput = () => {
        sound.volume = slider.value;
        saveData();
        if (sound.audio) {
            sound.audio.volume = slider.value;
        }
    };

    document.getElementById("soundDeleteBtn").onclick = () => {

        const group =
            data.groups.find(g => g.id === data.currentGroup);
        if (!group) return;

        // Free blob URL memory
        if (sound.file) {
            URL.revokeObjectURL(sound.file);
        }

        group.sounds =
            group.sounds.filter(
                s => s.id !== sound.id
            );

        closeSoundOptions();
        renderSounds();
        saveData();
    };
}

function closeSoundOptions() {

    const modal =
        document.getElementById("soundOptionsModal");

    modal.classList.remove("flex");
    modal.classList.add("hidden");
}

/* ---------------------------------------------------------
   SOUND UPLOAD
--------------------------------------------------------- */
function uploadSound(event) {
    if (!data.currentGroup) return alert("Select a group first.");

    const fileInput = document.getElementById("soundUpload");
    const file = event.target.files[0];
    if (!file) return;

    const sound = {
        id: "sound_" + Date.now(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        fileData: file,
        file: URL.createObjectURL(file),
        volume: 1.0,
        color: "bg-blue-600",
        loop: false,
        fading: false,
        audio: null,
        playing: false
    };

    const group = data.groups.find(g => g.id === data.currentGroup);
    group.sounds.push(sound);

    fileInput.value = ""; // RESET INPUT

    renderSounds();
    saveData();
}

/* ---------------------------------------------------------
   SOUND BUTTONS
--------------------------------------------------------- */
function renderSounds() {
    const container = document.getElementById("soundGrid");
    container.innerHTML = "";

    if (!data.currentGroup) return;

    const group = data.groups.find(g => g.id === data.currentGroup);

    if (!group) return;

    group.sounds.forEach(sound => {
        const wrapper = document.createElement("div");

        wrapper.className = "relative";

        const btn = document.createElement("button");

        btn.className =
            `${sound.color} w-full h-32 rounded-xl text-white font-bold text-lg transition-all`;

        updatePlayButtonStyle(btn, sound.playing);

        btn.textContent = sound.name;

        btn.onclick = () =>
            toggleSound(sound, btn);

        // LONG PRESS
        let pressTimer;

        btn.addEventListener("mousedown", () => {
            pressTimer = setTimeout(() => {
                openSoundOptions(sound);
            }, 600);

        });

        btn.addEventListener("mouseup", () => clearTimeout(pressTimer)
        );

        btn.addEventListener("mouseleave", () => clearTimeout(pressTimer)
        );

        wrapper.appendChild(btn);

        container.appendChild(wrapper);
    });
}

/* ---------------------------------------------------------
   PLAY BUTTON STYLE
--------------------------------------------------------- */
function updatePlayButtonStyle(btn, playing) {

    btn.classList.remove(
        "bg-opacity-60",
        "ring-4",
        "ring-cyan-300",
        "shadow-xl",
        "shadow-cyan-500/50"
    );

    if (playing) {

        btn.classList.add(
            "bg-opacity-60",
            "ring-4",
            "ring-cyan-300",
            "shadow-xl",
            "shadow-cyan-500/50"
        );
    }
}

/* ---------------------------------------------------------
   TOGGLE BUTTON STYLE
--------------------------------------------------------- */
function updateToggleStyle(btn, active) {
    if (active) {
        btn.classList.add("bg-green-600", "text-white");
        btn.classList.remove("bg-gray-700");
    } else {
        btn.classList.add("bg-gray-700");
        btn.classList.remove("bg-green-600");
    }
}

/* ---------------------------------------------------------
   PLAY / STOP + FIXED REPLAY BEHAVIOR
--------------------------------------------------------- */
function toggleSound(sound, btn) {
    // If not currently playing → start fresh
    if (!sound.audio) {
        // Always create a brand‑new Audio object
        const audio = new Audio(sound.file);

        sound.audio = audio;
        sound.audio.volume = sound.volume;
        sound.audio.loop = sound.loop;

        // Clear any previous handler, then set a fresh one
        sound.audio.onended = null;
        sound.audio.onended = () => {
            if (!sound.loop) {
                sound.playing = false;
                sound.audio = null;
                updatePlayButtonStyle(btn, false);
            }
        };

        sound.audio.play();
        sound.playing = true;
        updatePlayButtonStyle(btn, true);

    } else {
        // STOP EARLY
        sound.audio.pause();
        sound.audio.currentTime = 0;
        sound.audio = null;
        sound.playing = false;
        updatePlayButtonStyle(btn, false);
    }
}

/* ---------------------------------------------------------
   FADE OUT
--------------------------------------------------------- */
function fadeOut(sound) {
    if (!sound.audio) return;

    const fade = setInterval(() => {
        if (sound.audio.volume > 0.05) {
            sound.audio.volume -= 0.05;
        } else {
            clearInterval(fade);
            sound.audio.pause();
            sound.audio.currentTime = 0;
            sound.audio = null;
            sound.playing = false;
            sound.fading = false;
            renderSounds();
            saveData();
        }
    }, 100);
}

/* ---------------------------------------------------------
   DELETE SOUND (WITH MODAL)
--------------------------------------------------------- */
function confirmDelete() {
    const group = data.groups.find(g => g.id === data.currentGroup);

    if (!group) return;

    group.sounds = group.sounds.filter(s => s.id !== pendingDeleteId);
    pendingDeleteId = null;
    const modal = document.getElementById("deleteModal");

    modal.classList.remove("flex");
    modal.classList.add("hidden");
    renderSounds();
    saveData();
}

function cancelDelete() {

    pendingDeleteId = null;

    const modal = document.getElementById("deleteModal");

    modal.classList.remove("flex");
    modal.classList.add("hidden");
}

/* ---------------------------------------------------------
   Initialize DB
--------------------------------------------------------- */

(async () => {

    await openDatabase();

    await loadData();

    await enableWakeLock();

})();