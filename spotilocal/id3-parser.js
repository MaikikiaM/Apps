/**
 * Universal Audio Metadata & ID3 / FLAC / M4A Parser for SpotiLocal
 * Extracts Title, Artist, Album, Year, Genre, and embedded cover images
 * Supports: ID3v2.2, ID3v2.3, ID3v2.4, FLAC (Vorbis Comment & Picture Block), M4A/MP4 (covr), and ID3v1.
 */
class ID3Parser {
  static isGenericTitle(title) {
    if (!title) return true;
    const s = String(title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return s === "" ||
           s === "cancion" ||
           s === "sin titulo" ||
           s === "untitled" ||
           s === "unknown" ||
           s === "desconocido" ||
           s === "audio" ||
           s === "tema" ||
           s === "pista" ||
           s === "track" ||
           s.includes("historica") ||
           s.includes("recuperada") ||
           s.startsWith("cancion") ||
           s.startsWith("tema") ||
           s.startsWith("audio") ||
           s.startsWith("pista") ||
           s.startsWith("track") ||
           s.startsWith("song_") ||
           s.startsWith("folder_");
  }

  static async parse(file) {
    if (!file) return null;

    const rawName = (file && typeof file.name === "string") ? file.name.replace(/\.[^/.]+$/, "") : "";
    const defaultMeta = {
      title: rawName || "Canción",
      artist: "Artista Desconocido",
      album: "Álbum Desconocido",
      year: "",
      genre: "Música",
      coverUrl: null,
      coverBlob: null
    };

    try {
      const fileSize = file.size || 0;
      const previewSize = Math.min(fileSize || 2048, 2048);
      const headerBuffer = await file.slice(0, previewSize).arrayBuffer();
      const headerView = new DataView(headerBuffer);
      const u8Header = new Uint8Array(headerBuffer);

      // Helper to find needle in header
      const findNeedle = (needle, limit = previewSize) => {
        const nLen = needle.length;
        for (let i = 0; i <= limit - nLen; i++) {
          let match = true;
          for (let j = 0; j < nLen; j++) {
            if (u8Header[i + j] !== needle.charCodeAt(j)) { match = false; break; }
          }
          if (match) return i;
        }
        return -1;
      };

      // 1. Check FLAC ("fLaC")
      const flacPos = findNeedle("fLaC", 16);
      if (flacPos !== -1) {
        const flacSliceSize = Math.min(fileSize || 16 * 1024 * 1024, 16 * 1024 * 1024);
        const flacBuffer = await file.slice(flacPos, flacSliceSize).arrayBuffer();
        const parsedFLAC = ID3Parser.parseFLAC(flacBuffer, defaultMeta);
        if (parsedFLAC) return parsedFLAC;
      }

      // 2. Check M4A / MP4 ("ftyp" or "moov")
      const ftypPos = findNeedle("ftyp", 32);
      const moovPos = findNeedle("moov", 512);
      if (ftypPos !== -1 || moovPos !== -1) {
        const m4aSliceSize = Math.min(fileSize || 16 * 1024 * 1024, 16 * 1024 * 1024);
        const m4aBuffer = await file.slice(0, m4aSliceSize).arrayBuffer();
        const parsedM4A = ID3Parser.parseM4A(m4aBuffer, defaultMeta);
        if (parsedM4A) return parsedM4A;
      }

      // 3. Check ID3v2 ("ID3")
      let v2Tags = null;
      const id3Pos = findNeedle("ID3", Math.min(previewSize, 1024));
      if (id3Pos !== -1 && id3Pos + 10 <= headerBuffer.byteLength) {
        const rawTagSize = ID3Parser.decodeSynchsafeInt(headerView.getUint32(id3Pos + 6));
        const totalTagSize = Math.min(id3Pos + rawTagSize + 10, Math.min(fileSize || 32 * 1024 * 1024, 32 * 1024 * 1024));
        const fullBuffer = await file.slice(id3Pos, totalTagSize).arrayBuffer();
        v2Tags = ID3Parser.parseID3v2(fullBuffer, defaultMeta);
      }

      // 4. Check ID3v1 (last 128 bytes)
      let v1Tags = null;
      if (fileSize >= 128) {
        const v1Buffer = await file.slice(fileSize - 128, fileSize).arrayBuffer();
        v1Tags = ID3Parser.parseID3v1(v1Buffer, defaultMeta);
      }

      // Combine ID3v2 & ID3v1 tags to guarantee title and cover are both captured
      if (v2Tags || v1Tags) {
        const merged = { ...defaultMeta };
        if (v2Tags) {
          if (v2Tags.title && v2Tags.title !== defaultMeta.title && !ID3Parser.isGenericTitle(v2Tags.title)) {
            merged.title = v2Tags.title;
          }
          if (v2Tags.artist && v2Tags.artist !== defaultMeta.artist) merged.artist = v2Tags.artist;
          if (v2Tags.album && v2Tags.album !== defaultMeta.album) merged.album = v2Tags.album;
          if (v2Tags.year) merged.year = v2Tags.year;
          if (v2Tags.genre) merged.genre = v2Tags.genre;
          if (v2Tags.coverBlob) merged.coverBlob = v2Tags.coverBlob;
          if (v2Tags.coverUrl) merged.coverUrl = v2Tags.coverUrl;
        }

        if (v1Tags) {
          if ((!merged.title || merged.title === defaultMeta.title || ID3Parser.isGenericTitle(merged.title)) && v1Tags.title && !ID3Parser.isGenericTitle(v1Tags.title)) {
            merged.title = v1Tags.title;
          }
          if ((!merged.artist || merged.artist === defaultMeta.artist) && v1Tags.artist) {
            merged.artist = v1Tags.artist;
          }
          if ((!merged.album || merged.album === defaultMeta.album) && v1Tags.album) {
            merged.album = v1Tags.album;
          }
          if (!merged.year && v1Tags.year) merged.year = v1Tags.year;
        }

        if (merged.title !== defaultMeta.title || merged.coverBlob || merged.artist !== defaultMeta.artist) {
          return merged;
        }
      }
    } catch (e) {
      console.warn("Universal Audio Parser error:", e);
    }

    return defaultMeta;
  }

  static parseID3v2(buffer, defaultMeta) {
    try {
      const view = new DataView(buffer);
      if (buffer.byteLength < 10) return null;
      const version = view.getUint8(3);
      const flags = view.getUint8(5);
      const size = ID3Parser.decodeSynchsafeInt(view.getUint32(6));

      let offset = 10;
      if ((flags & 0x40) !== 0 && buffer.byteLength >= 14) {
        const extSize = ID3Parser.decodeSynchsafeInt(view.getUint32(10));
        offset += extSize;
      }

      const tags = {};
      const maxOffset = Math.min(buffer.byteLength, 10 + size);

      while (offset < maxOffset - 6) {
        let frameID, frameSize;
        if (version === 3 || version === 4) {
          if (offset + 10 > buffer.byteLength) break;
          frameID = ID3Parser.getString(view, offset, 4);
          frameSize = version === 4
            ? ID3Parser.decodeSynchsafeInt(view.getUint32(offset + 4))
            : view.getUint32(offset + 4);
          offset += 10;
        } else if (version === 2) {
          if (offset + 6 > buffer.byteLength) break;
          frameID = ID3Parser.getString(view, offset, 3);
          frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
          offset += 6;
        } else {
          break;
        }

        if (!frameID || frameID.charCodeAt(0) === 0 || frameSize <= 0) break;
        if (offset + frameSize > buffer.byteLength) {
          if ((frameID === "APIC" || frameID === "PIC") && offset < buffer.byteLength) {
            const partialCover = ID3Parser.parseAPICFrame(view, offset, buffer.byteLength - offset, version);
            if (partialCover) {
              tags.coverBlob = partialCover;
              tags.coverUrl = URL.createObjectURL(partialCover);
            }
          }
          break;
        }

        const frameDataOffset = offset;
        offset += frameSize;

        if (frameID === "TIT2" || frameID === "TT2") {
          tags.title = ID3Parser.parseFrameText(view, frameDataOffset, frameSize);
        } else if (frameID === "TPE1" || frameID === "TP1") {
          tags.artist = ID3Parser.parseFrameText(view, frameDataOffset, frameSize);
        } else if (frameID === "TALB" || frameID === "TAL") {
          tags.album = ID3Parser.parseFrameText(view, frameDataOffset, frameSize);
        } else if (frameID === "TYER" || frameID === "TDRC" || frameID === "TYE") {
          tags.year = ID3Parser.parseFrameText(view, frameDataOffset, frameSize);
        } else if (frameID === "TCON" || frameID === "TCO") {
          tags.genre = ID3Parser.parseFrameText(view, frameDataOffset, frameSize);
        } else if (frameID === "APIC" || frameID === "PIC") {
          const coverBlob = ID3Parser.parseAPICFrame(view, frameDataOffset, frameSize, version);
          if (coverBlob) {
            tags.coverUrl = URL.createObjectURL(coverBlob);
            tags.coverBlob = coverBlob;
          }
        }
      }

      return {
        title: tags.title || defaultMeta.title,
        artist: tags.artist || defaultMeta.artist,
        album: tags.album || defaultMeta.album,
        year: tags.year || defaultMeta.year,
        genre: tags.genre || defaultMeta.genre,
        coverUrl: tags.coverUrl || null,
        coverBlob: tags.coverBlob || null
      };
    } catch (e) {
      console.warn("ID3v2 parse error:", e);
      return null;
    }
  }

  static parseFLAC(buffer, defaultMeta) {
    try {
      const view = new DataView(buffer);
      if (view.byteLength < 4) return null;
      let offset = 4;
      let isLast = false;
      const tags = { ...defaultMeta };
      const decoder = new TextDecoder("utf-8");

      while (offset < buffer.byteLength - 4 && !isLast) {
        const b0 = view.getUint8(offset);
        isLast = (b0 & 0x80) !== 0;
        const type = b0 & 0x7F;
        const len = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
        offset += 4;
        if (offset + len > buffer.byteLength) break;

        if (type === 4) { // VORBIS_COMMENT
          let cur = offset;
          if (cur + 4 <= offset + len) {
            const vendorLen = view.getUint32(cur, true);
            cur += 4 + vendorLen;
            if (cur + 4 <= offset + len) {
              const commentCount = view.getUint32(cur, true);
              cur += 4;
              for (let i = 0; i < commentCount && cur < offset + len; i++) {
                if (cur + 4 > offset + len) break;
                const cLen = view.getUint32(cur, true);
                cur += 4;
                if (cur + cLen <= offset + len) {
                  const comment = decoder.decode(new Uint8Array(buffer, cur, cLen));
                  cur += cLen;
                  const eq = comment.indexOf("=");
                  if (eq > 0) {
                    const k = comment.slice(0, eq).toUpperCase();
                    const v = comment.slice(eq + 1).trim();
                    if (k === "TITLE" && v) tags.title = v;
                    else if (k === "ARTIST" && v) tags.artist = v;
                    else if (k === "ALBUM" && v) tags.album = v;
                    else if ((k === "DATE" || k === "YEAR") && v) tags.year = v;
                    else if (k === "GENRE" && v) tags.genre = v;
                  }
                } else break;
              }
            }
          }
        } else if (type === 6) { // PICTURE
          let cur = offset;
          if (cur + 8 <= offset + len) {
            cur += 4; // skip picture type
            const mimeLen = view.getUint32(cur, false);
            cur += 4;
            if (cur + mimeLen <= offset + len) {
              const mime = decoder.decode(new Uint8Array(buffer, cur, mimeLen));
              cur += mimeLen;
              const descLen = view.getUint32(cur, false);
              cur += 4 + descLen + 16; // skip desc + width, height, depth, colors
              if (cur + 4 <= offset + len) {
                const dataLen = view.getUint32(cur, false);
                cur += 4;
                if (cur + dataLen <= offset + len) {
                  const picBlob = new Blob([buffer.slice(cur, cur + dataLen)], { type: mime || "image/jpeg" });
                  tags.coverBlob = picBlob;
                  tags.coverUrl = URL.createObjectURL(picBlob);
                }
              }
            }
          }
        }
        offset += len;
      }
      return tags;
    } catch (e) {
      console.warn("FLAC parse error:", e);
      return null;
    }
  }

  static parseM4A(buffer, defaultMeta) {
    try {
      const u8 = new Uint8Array(buffer);
      const view = new DataView(buffer);
      const tags = { ...defaultMeta };

      const indexOfStr = (target, start = 0) => {
        const tLen = target.length;
        const limit = u8.length - tLen;
        for (let i = start; i <= limit; i++) {
          let m = true;
          for (let j = 0; j < tLen; j++) {
            if (u8[i + j] !== target.charCodeAt(j)) { m = false; break; }
          }
          if (m) return i;
        }
        return -1;
      };

      // Search for 'covr' atom
      const covrIdx = indexOfStr("covr");
      if (covrIdx !== -1) {
        const dataIdx = indexOfStr("data", covrIdx);
        if (dataIdx !== -1 && dataIdx - covrIdx <= 40) {
          const dataLen = view.getUint32(dataIdx - 4, false);
          const typeCode = view.getUint32(dataIdx + 4, false) & 0xFF;
          const mime = (typeCode === 14) ? "image/png" : "image/jpeg";
          const imgStart = dataIdx + 12;
          const imgEnd = (dataIdx - 4) + dataLen;
          if (imgStart < imgEnd && imgEnd <= buffer.byteLength) {
            const picBlob = new Blob([buffer.slice(imgStart, imgEnd)], { type: mime });
            tags.coverBlob = picBlob;
            tags.coverUrl = URL.createObjectURL(picBlob);
          }
        }
      }

      // Read text atoms: ©nam, ©ART, ©alb, ©day
      const readM4AText = (fourCC) => {
        const idx = indexOfStr(fourCC);
        if (idx !== -1) {
          const dataIdx = indexOfStr("data", idx);
          if (dataIdx !== -1 && dataIdx - idx <= 40) {
            const dataLen = view.getUint32(dataIdx - 4, false);
            const textStart = dataIdx + 12;
            const textEnd = (dataIdx - 4) + dataLen;
            if (textStart < textEnd && textEnd <= buffer.byteLength) {
              const decoder = new TextDecoder("utf-8");
              return decoder.decode(new Uint8Array(buffer, textStart, textEnd - textStart)).trim();
            }
          }
        }
        return null;
      };

      const title = readM4AText("©nam");
      const artist = readM4AText("©ART");
      const album = readM4AText("©alb");
      const year = readM4AText("©day");
      if (title) tags.title = title;
      if (artist) tags.artist = artist;
      if (album) tags.album = album;
      if (year) tags.year = year;

      return tags;
    } catch (e) {
      console.warn("M4A parse error:", e);
      return null;
    }
  }

  static parseID3v1(buffer, defaultMeta) {
    try {
      const view = new DataView(buffer);
      if (buffer.byteLength < 128) return null;
      const start = buffer.byteLength - 128;
      // Fixed magic bytes: 'T' (0x54), 'A' (0x41), 'G' (0x47)
      if (view.getUint8(start) === 0x54 && view.getUint8(start + 1) === 0x41 && view.getUint8(start + 2) === 0x47) {
        const readStr = (pos, len) => {
          let s = "";
          for (let i = 0; i < len; i++) {
            const b = view.getUint8(pos + i);
            if (b === 0) break;
            s += String.fromCharCode(b);
          }
          return s.trim();
        };
        const title = readStr(start + 3, 30);
        const artist = readStr(start + 33, 30);
        const album = readStr(start + 63, 30);
        const year = readStr(start + 93, 4);
        return {
          title: title || defaultMeta.title,
          artist: artist || defaultMeta.artist,
          album: album || defaultMeta.album,
          year: year || defaultMeta.year,
          genre: defaultMeta.genre,
          coverUrl: null,
          coverBlob: null
        };
      }
    } catch (e) {}
    return null;
  }

  static decodeSynchsafeInt(num) {
    return ((num & 0x7f000000) >> 3) |
           ((num & 0x007f0000) >> 2) |
           ((num & 0x00007f00) >> 1) |
           (num & 0x0000007f);
  }

  static getString(view, offset, length) {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
  }

  static parseFrameText(view, offset, length) {
    if (length <= 1) return "";
    const encoding = view.getUint8(offset);
    const u8 = new Uint8Array(view.buffer, view.byteOffset + offset + 1, length - 1);
    if (u8.length === 0) return "";

    try {
      if (encoding === 0) { // ISO-8859-1 / Latin1 or fallback UTF-8
        try {
          const dec = new TextDecoder("utf-8", { fatal: true });
          return dec.decode(u8).replace(/\0.*$/, "").trim();
        } catch(e) {
          return new TextDecoder("latin1").decode(u8).replace(/\0.*$/, "").trim();
        }
      } else if (encoding === 1) { // UTF-16 with BOM
        if (u8.length >= 2) {
          if (u8[0] === 0xFE && u8[1] === 0xFF) {
            return new TextDecoder("utf-16be").decode(u8.subarray(2)).replace(/\0.*$/, "").trim();
          } else if (u8[0] === 0xFF && u8[1] === 0xFE) {
            return new TextDecoder("utf-16le").decode(u8.subarray(2)).replace(/\0.*$/, "").trim();
          }
        }
        return new TextDecoder("utf-16le").decode(u8).replace(/\0.*$/, "").trim();
      } else if (encoding === 2) { // UTF-16BE without BOM
        return new TextDecoder("utf-16be").decode(u8).replace(/\0.*$/, "").trim();
      } else if (encoding === 3) { // UTF-8
        return new TextDecoder("utf-8").decode(u8).replace(/\0.*$/, "").trim();
      }
    } catch(e) {}

    return new TextDecoder("latin1").decode(u8).replace(/\0.*$/, "").trim();
  }

  static parseAPICFrame(view, offset, length, version) {
    try {
      const encoding = view.getUint8(offset);
      let curr = offset + 1;

      let mimeType = "image/jpeg";
      if (version === 2) {
        const format = ID3Parser.getString(view, curr, 3).toLowerCase();
        curr += 3;
        if (format === "png") mimeType = "image/png";
      } else {
        let mimeStr = "";
        while (curr < offset + length && view.getUint8(curr) !== 0) {
          mimeStr += String.fromCharCode(view.getUint8(curr));
          curr++;
        }
        curr++; // Skip null byte
        if (mimeStr) mimeType = mimeStr;
      }

      curr++; // skip picture type

      // Skip description
      if (encoding === 0 || encoding === 3) {
        while (curr < offset + length && view.getUint8(curr) !== 0) curr++;
        curr++;
      } else if (encoding === 1 || encoding === 2) {
        while (curr < offset + length - 1 && (view.getUint8(curr) !== 0 || view.getUint8(curr + 1) !== 0)) curr += 2;
        curr += 2;
      }

      // Highly reliable magic-byte image scan (JPEG / PNG / WebP / GIF)
      let foundStart = -1;
      let detectedMime = mimeType;
      const scanLimit = Math.min(offset + length - 4, offset + 2048);
      for (let i = offset + 1; i <= scanLimit; i++) {
        // JPEG: FF D8 FF
        if (view.getUint8(i) === 0xFF && view.getUint8(i+1) === 0xD8 && view.getUint8(i+2) === 0xFF) {
          foundStart = i;
          detectedMime = "image/jpeg";
          break;
        }
        // PNG: 89 50 4E 47
        if (view.getUint8(i) === 0x89 && view.getUint8(i+1) === 0x50 && view.getUint8(i+2) === 0x4E && view.getUint8(i+3) === 0x47) {
          foundStart = i;
          detectedMime = "image/png";
          break;
        }
        // GIF: 47 49 46 38
        if (view.getUint8(i) === 0x47 && view.getUint8(i+1) === 0x49 && view.getUint8(i+2) === 0x46 && view.getUint8(i+3) === 0x38) {
          foundStart = i;
          detectedMime = "image/gif";
          break;
        }
        // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
        if (view.getUint8(i) === 0x52 && view.getUint8(i+1) === 0x49 && view.getUint8(i+2) === 0x46 && view.getUint8(i+3) === 0x46 &&
            i + 12 <= offset + length &&
            view.getUint8(i+8) === 0x57 && view.getUint8(i+9) === 0x45 && view.getUint8(i+10) === 0x42 && view.getUint8(i+11) === 0x50) {
          foundStart = i;
          detectedMime = "image/webp";
          break;
        }
      }

      const imgStart = foundStart !== -1 ? foundStart : curr;
      if (imgStart < offset + length) {
        const imgData = view.buffer.slice(view.byteOffset + imgStart, view.byteOffset + offset + length);
        if (imgData.byteLength > 64) {
          return new Blob([imgData], { type: detectedMime });
        }
      }
    } catch (e) {
      console.warn("APIC parse error:", e);
    }
    return null;
  }
}

window.ID3Parser = ID3Parser;
