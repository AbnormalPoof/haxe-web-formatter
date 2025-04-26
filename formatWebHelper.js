let savedConfig = JSON.parse(localStorage.getItem("formatterConfig") || "{}");
let pendingFiles = null;

document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("fileUpload")
    ?.addEventListener("change", handleFileUpload);
  document
    .getElementById("configUpload")
    ?.addEventListener("change", handleConfigUpload);
  document
    .getElementById("formatButton")
    ?.addEventListener("click", handleFormatClick);
  document.getElementById("clearFiles")?.addEventListener("click", clearFiles);

  // near lil transition for dark and light mode ehehe
  document.getElementById("modeToggle").addEventListener("click", function () {
    const body = document.body;
    const h1 = document.querySelector("h1");
    const textareas = document.querySelectorAll("textarea");
    const buttons = document.querySelectorAll("button");
    const uploadContainers = document.querySelectorAll(".upload-container");
    const progressBar = document.getElementById("progressBar");
    const githubLogo = document.querySelector('img[alt="GitHub"]');

    body.classList.toggle("light-mode");
    h1.classList.toggle("light-mode");
    textareas.forEach((textarea) => textarea.classList.toggle("light-mode"));
    uploadContainers.forEach((container) =>
      container.classList.toggle("light-mode")
    );
    progressBar.classList.toggle("light-mode");

    if (body.classList.contains("light-mode")) {
      githubLogo.src = "github-mark.png";
    } else {
      githubLogo.src = "github-mark-white.png";
    }

    buttons.forEach((button) => {
      button.classList.remove("light-mode");
    });

    if (body.classList.contains("light-mode")) {
      document.getElementById("modeToggle").textContent = "Switch to Dark Mode";
    } else {
      document.getElementById("modeToggle").textContent =
        "Switch to Light Mode";
    }
  });

  if (Object.keys(savedConfig).length > 0) {
    document.getElementById("configBox").value = JSON.stringify(
      savedConfig,
      null,
      2
    );
  }

  function addDragEvents(element) {
    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.add("dragover");
    });

    element.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove("dragover");
    });
  }

  function handleDropEvent(element, callback) {
    element.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove("dragover");
      await callback(e);
    });
  }

  function setupDragAndDrop() {
    const codeBox = document.getElementById("codeBox");
    const configBox = document.getElementById("configBox");
    const uploadArea = document.querySelector(".upload-container");

    [codeBox, configBox, uploadArea].forEach(addDragEvents);

    handleDropEvent(codeBox, async (e) => {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 1) {
        const text = await files[0].text();
        codeBox.value = text;
      } else {
        pendingFiles = files;
        alert(`${files.length} files loaded!\nClick Format to process them.`);
      }
    });

    handleDropEvent(configBox, async (e) => {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 1) {
        try {
          const text = await files[0].text();
          const config = JSON.parse(text);
          savedConfig = config;
          configBox.value = JSON.stringify(config, null, 2);
          localStorage.setItem("formatterConfig", JSON.stringify(config));
        } catch (e) {
          console.error("Config parsing error:", e);
          alert("Error loading configuration file - invalid JSON");
        }
      }
    });

    handleDropEvent(uploadArea, (e) => {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      pendingFiles = files;
      alert(
        files.length === 1
          ? "1 file loaded!\nClick Format to process them."
          : `${files.length} files loaded!\nClick Format to process them.`
      );
    });
  }

  setupDragAndDrop();
});

function clearFiles() {
  pendingFiles = null;
  document.getElementById("fileUpload").value = "";
}

function handleConfigUpload(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function () {
    try {
      savedConfig = JSON.parse(reader.result);
      const configBox = document.getElementById("configBox");
      configBox.value = JSON.stringify(savedConfig, null, 2);
      localStorage.setItem("formatterConfig", JSON.stringify(savedConfig));
    } catch (e) {
      console.error("Config parsing error:", e);
      alert("Error loading configuration file - invalid JSON");
    }
  };
  reader.readAsText(file);
}

document.getElementById("configBox")?.addEventListener("change", function () {
  try {
    const configValue = JSON.parse(this.value);
    savedConfig = configValue;
    localStorage.setItem("formatterConfig", JSON.stringify(configValue));
  } catch (e) {
    console.error("Invalid JSON in config box:", e);
  }
});

function handleFileUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  pendingFiles = files;
}

function handleFormatClick() {
  const codeBoxContent = document.getElementById("codeBox").value.trim();
  if (codeBoxContent) {
    formatCode();
    return;
  }

  if (!pendingFiles) {
    alert("Please either enter code in the text box or upload files!");
    return;
  }

  if (pendingFiles.length === 1 && pendingFiles[0].name.endsWith(".zip")) {
    handleZipFile(pendingFiles[0]);
  } else {
    handleMultipleFiles(pendingFiles);
  }
}

function showProgress(show) {
  document.getElementById("progressContainer").style.display = show
    ? "block"
    : "none";
}

function updateProgress(current, total, filename) {
  const percent = (current / total) * 100;
  document.getElementById("progressBar").value = percent;
  document.getElementById(
    "progressText"
  ).textContent = `Formatting file ${filename} (${current}/${total})`;
}

function handleZipFile(zipFile) {
  const zip = new JSZip();
  showProgress(true);

  zip.loadAsync(zipFile).then(function (contents) {
    const fileCount = Object.keys(contents.files).filter(
      (name) => !contents.files[name].dir
    ).length;
    let processed = 0;

    processFiles(contents.files, zip, (filename) => {
      processed++;
      updateProgress(processed, fileCount, filename);
    }).then(() => {
      zip.generateAsync({ type: "blob" }).then(function (blob) {
        showProgress(false);
        downloadFile(blob, "formatter_output.zip");
      });
    });
  });
}

function finalizeZipAndDownload(zip, singleFileName = null) {
  if (singleFileName) {
    const content = zip.files[singleFileName].async("string");
    content.then((text) => {
      showProgress(false);
      downloadFile(text, singleFileName);
    });
  } else {
    zip.generateAsync({ type: "blob" }).then((blob) => {
      showProgress(false);
      downloadFile(blob, "formatter_output.zip");
    });
  }
}

function handleMultipleFiles(files) {
  const zip = new JSZip();
  showProgress(true);
  let processed = 0;

  const processPromises = files.map((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function () {
        const fileContent = reader.result;
        const formattedContent = formatCodeForFile(fileContent);
        const filePath = file.webkitRelativePath || file.name;

        processed++;
        updateProgress(processed, files.length, file.name);

        zip.file(filePath, formattedContent);
        resolve();
      };
      reader.readAsText(file);
    });
  });

  Promise.all(processPromises).then(() => {
    finalizeZipAndDownload(zip, files.length === 1 ? files[0].name : null);
  });
}

async function processFiles(files, zip, onProgress) {
  const promises = [];

  for (const [filename, file] of Object.entries(files)) {
    if (!file.dir) {
      const promise = file.async("string").then((content) => {
        const formattedContent = formatCodeForFile(content);
        zip.file(filename, formattedContent);
        if (onProgress) onProgress(filename);
      });
      promises.push(promise);
    }
  }

  return Promise.all(promises);
}

function formatCodeForFile(code) {
  let configText = savedConfig
    ? JSON.stringify(savedConfig)
    : document.getElementById("configBox").value || "{}";
  try {
    return formatter.Formatter.formatString(code, configText);
  } catch (e) {
    console.error("Formatting error:", e);
    return code;
  }
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function formatCode() {
  const code = document.getElementById("codeBox").value.trim();
  if (!code) {
    alert("Please enter some code to format!");
    return;
  }

  let configText = savedConfig
    ? JSON.stringify(savedConfig)
    : document.getElementById("configBox").value || "{}";

  try {
    const result = formatter.Formatter.formatString(code, configText);
    document.getElementById("codeBox").value = result;
  } catch (e) {
    console.error("Formatting error:", e);
    alert("Formatting error!\n\n" + e);
  }
}
