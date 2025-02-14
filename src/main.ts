interface IshneHeader {
  magicNumber: string;
  checksum: number;
  headerSize: number;
  ecgBlockSize: number;
  variableBlockOffset: number;
  ecgBlockOffset: number;
  version: number;
  firstName: string;
  lastName: string;
  subjectId: string;
  sex: number;
  race: number;
  birthDate: [number, number, number];
  recordDate: [number, number, number];
  fileDate: [number, number, number];
  startTime: [number, number, number];
  nLeads: number;
  leadSpec: number[];
  leadQuality: number[];
  resolution: number[];
  pacemaker: number;
  recorder: string;
  samplingRate: number;
  proprietary: string;
  copyright: string;
}

export class IshneParser {
  private buffer: Uint8Array;
  private header: IshneHeader | null = null;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  public parseHeader(): IshneHeader {
    const decoder = new TextDecoder("ascii");
    const magicNumber = decoder.decode(this.buffer.slice(0, 8));
    if (magicNumber !== "ISHNE1.0") {
      throw new Error("Invalid ISHNE file");
    }

    const dataView = new DataView(this.buffer.buffer);
    const checksum = dataView.getUint16(8, true);
    const headerSize = 512;
    const ecgBlockSize = dataView.getInt32(522, true);
    const variableBlockOffset = dataView.getInt32(526, true);
    const ecgBlockOffset = dataView.getInt32(530, true);
    const version = dataView.getInt16(534, true);

    this.header = {
      magicNumber,
      checksum,
      headerSize,
      ecgBlockSize,
      variableBlockOffset,
      ecgBlockOffset,
      version,
      firstName: decoder.decode(this.buffer.slice(536, 576)).trim(),
      lastName: decoder.decode(this.buffer.slice(576, 616)).trim(),
      subjectId: decoder.decode(this.buffer.slice(616, 636)).trim(),
      sex: dataView.getInt16(636, true),
      race: dataView.getInt16(638, true),
      birthDate: [
        dataView.getInt16(640, true),
        dataView.getInt16(642, true),
        dataView.getInt16(644, true),
      ],
      recordDate: [
        dataView.getInt16(646, true),
        dataView.getInt16(648, true),
        dataView.getInt16(650, true),
      ],
      fileDate: [
        dataView.getInt16(652, true),
        dataView.getInt16(654, true),
        dataView.getInt16(656, true),
      ],
      startTime: [
        dataView.getInt16(658, true),
        dataView.getInt16(660, true),
        dataView.getInt16(662, true),
      ],
      nLeads: dataView.getInt16(664, true),
      leadSpec: Array.from({ length: 12 }, (_, i) =>
        dataView.getInt16(666 + i * 2, true),
      ),
      leadQuality: Array.from({ length: 12 }, (_, i) =>
        dataView.getInt16(690 + i * 2, true),
      ),
      resolution: Array.from({ length: 12 }, (_, i) =>
        dataView.getInt16(714 + i * 2, true),
      ),
      pacemaker: dataView.getInt16(738, true),
      recorder: decoder.decode(this.buffer.slice(740, 780)).trim(),
      samplingRate: dataView.getInt16(780, true),
      proprietary: decoder.decode(this.buffer.slice(782, 862)).trim(),
      copyright: decoder.decode(this.buffer.slice(862, 942)).trim(),
    };

    return this.header;
  }

  public parseEcgData(): number[][] {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }

    const { ecgBlockOffset, nLeads, ecgBlockSize } = this.header;
    const samplesCount = ecgBlockSize / (nLeads * 2);
    const ecgData: number[][] = Array.from({ length: nLeads }, () => []);
    const dataView = new DataView(this.buffer.buffer);

    for (let i = 0; i < samplesCount; i++) {
      for (let lead = 0; lead < nLeads; lead++) {
        const sampleOffset = ecgBlockOffset + (i * nLeads + lead) * 2;
        const sampleValue = dataView.getInt16(sampleOffset, true);
        ecgData[lead].push(sampleValue);
      }
    }

    return ecgData;
  }

  public toJson(): string {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }
    return JSON.stringify(
      { header: this.header, ecgData: this.parseEcgData() },
      null,
      2,
    );
  }
}
