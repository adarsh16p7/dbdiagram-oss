import { defineStore } from "pinia";
import { useEditorStore } from "src/store/editor";
import { useChartStore } from "src/store/chart";
import localforage from "localforage";

const fs = localforage.createInstance({
  name: "dbdiagram-oss",
  storeName: "files",
});

export const useFilesStore = defineStore("files", {
  state: () => ({
    saving: false,
    lastSave: 0,
    currentFile: "",
    files: [],
  }),
  getters: {
    getFiles(state) {
      return state.files;
    },
    getCurrentFile(state) {
      return state.currentFile;
    },
  },
  actions: {
    async loadFileList() {
      try {
        console.log("loading file list");
        const keys = await fs.keys();
        this.files = keys;
      } catch (error) {
        console.error("Error loading file list:", error);
      }
    },
    async loadFile(fileName) {
      try {
        await this.loadFileList();
        console.log("loading file", fileName);
        const file = await fs.getItem(fileName);
        if (file && file.source) {
          const editor = useEditorStore();
          const chart = useChartStore();

          chart.load(file.chart || {});
          editor.load({
            source: file.source,
          });

          this.$patch({
            currentFile: fileName,
          });
        }
      } catch (error) {
        console.error("Error loading file:", error);
      }
    },
    async saveFile(fileName) {
      this.saving = true;
      try {
        if (!fileName) {
          fileName = this.currentFile || this.generateDefaultFileName();
        }
        console.log("saving file", fileName);

        const editor = useEditorStore();
        const chart = useChartStore();

        const file = {
          ...editor.save,
          chart: chart.save,
        };

        await fs.setItem(fileName, JSON.parse(JSON.stringify(file)));
        await this.loadFileList();
        this.lastSave = new Date();
        if (this.currentFile !== fileName) {
          this.$patch({
            currentFile: fileName,
          });
        }
      } catch (error) {
        console.error("Error saving file:", error);
      } finally {
        this.saving = false;
      }
    },
    generateDefaultFileName() {
      let i = 1;
      let fileName = `Untitled (${i})`;
      while (this.files.indexOf(fileName) >= 0) {
        fileName = `Untitled (${i++})`;
      }
      return fileName;
    },
    async newFile() {
      this.$patch({
        currentFile: undefined,
      });

      const editor = useEditorStore();
      const chart = useChartStore();

      editor.$reset();
      chart.$reset();
      await this.saveFile();
    },
    async deleteFile(fileName) {
      if (!fileName) return;
      try {
        await fs.removeItem(fileName);
        await this.loadFileList();
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    },
    async renameFile(newName) {
      const oldName = this.currentFile;
      try {
        await this.saveFile(newName);
        if (oldName !== newName) {
          await this.deleteFile(oldName);
          this.currentFile = newName;
        }
        await this.loadFileList();
      } catch (error) {
        console.error("Error renaming file:", error);
      }
    },
    async loadFileFromUpload(fileContent, fileName) {
      try {
        console.log("loading file from upload", fileName);
        const editor = useEditorStore();
        const chart = useChartStore();
        const fileData = JSON.parse(fileContent);
        editor.load({
          source: fileData.source,
        });
        chart.load(fileData.chart || {});
        await fs.setItem(fileName, fileData);
        await this.loadFileList();
        this.currentFile = fileName;
        console.log(`Current file set to ${this.currentFile}`);
      } catch (error) {
        console.error(`Error loading file from upload: ${error}`);
      }
    },
  },
});
