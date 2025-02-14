interface IshneHeader {
  varLengthBlockSize: number;
  sampleSizeEcg: number;
  offsetVarLengthBlock: number;
  offsetEcgBlock: number;
  fileVersion: number;
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

interface ExportOptions {
  separator?: string;              
  includeHeader?: boolean;        
  samplesPerLine?: number;        
  timeColumn?: boolean;           
  decimalPlaces?: number;        
}

interface IshneJson {
  metadata: {
    patientInfo: {
      id: string;
      firstName: string;
      lastName: string;
      sex: number;
      race: number;
      birthDate: number[];
    };
    recordInfo: {
      date: number[];
      startTime: number[];
      samplingRate: number;
      numberOfLeads: number;
      leadResolutions: number[];
      duration: number;
    };
    technical: {
      fileVersion: number;
      pacemaker: number;
      recorder: string;
    };
  };
  data: {
    time?: number[];
    leads: number[][];
  };
}

export class IshneParser {
  private buffer: Uint8Array;
  private header: IshneHeader | null = null;
  private dataView: DataView;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.dataView = new DataView(buffer.buffer);
  }

  private readString(offset: number, length: number): string {
    // Reads a string and removes null characters at the end
    return new TextDecoder("ascii")
      .decode(this.buffer.slice(offset, offset + length))
      .replace(/\x00+$/, '');
  }

  public parseHeader(): IshneHeader {
    // Verify magic number
    const magicNumber = this.readString(0, 8);
    if (magicNumber !== "ISHNE1.0") {
      throw new Error("Invalid ISHNE file format");
    }

    // Start reading from byte 10 (after magic number and checksum)
    const HEADER_START = 10;

    this.header = {
      varLengthBlockSize: this.dataView.getUint32(HEADER_START + 0, true),
      sampleSizeEcg: this.dataView.getUint32(HEADER_START + 4, true),
      offsetVarLengthBlock: this.dataView.getUint32(HEADER_START + 8, true),
      offsetEcgBlock: this.dataView.getUint32(HEADER_START + 12, true),
      fileVersion: this.dataView.getUint16(HEADER_START + 16, true),
      firstName: this.readString(HEADER_START + 18, 40),
      lastName: this.readString(HEADER_START + 58, 40),
      subjectId: this.readString(HEADER_START + 98, 20),
      sex: this.dataView.getUint16(HEADER_START + 118, true),
      race: this.dataView.getUint16(HEADER_START + 120, true),
      birthDate: [
        this.dataView.getUint16(HEADER_START + 122, true),
        this.dataView.getUint16(HEADER_START + 124, true),
        this.dataView.getUint16(HEADER_START + 126, true),
      ],
      recordDate: [
        this.dataView.getUint16(HEADER_START + 128, true),
        this.dataView.getUint16(HEADER_START + 130, true),
        this.dataView.getUint16(HEADER_START + 132, true),
      ],
      fileDate: [
        this.dataView.getUint16(HEADER_START + 134, true),
        this.dataView.getUint16(HEADER_START + 136, true),
        this.dataView.getUint16(HEADER_START + 138, true),
      ],
      startTime: [
        this.dataView.getUint16(HEADER_START + 140, true),
        this.dataView.getUint16(HEADER_START + 142, true),
        this.dataView.getUint16(HEADER_START + 144, true),
      ],
      nLeads: this.dataView.getUint16(HEADER_START + 146, true),
      leadSpec: Array.from({ length: 12 }, (_, i) =>
        this.dataView.getInt16(HEADER_START + 148 + i * 2, true)
      ),
      leadQuality: Array.from({ length: 12 }, (_, i) =>
        this.dataView.getInt16(HEADER_START + 172 + i * 2, true)
      ),
      resolution: Array.from({ length: 12 }, (_, i) =>
        this.dataView.getInt16(HEADER_START + 196 + i * 2, true)
      ),
      pacemaker: this.dataView.getUint16(HEADER_START + 220, true),
      recorder: this.readString(HEADER_START + 222, 40),
      samplingRate: this.dataView.getUint16(HEADER_START + 262, true),
      proprietary: this.readString(HEADER_START + 264, 80),
      copyright: this.readString(HEADER_START + 344, 80),
    };

    return this.header;
  }

  private calculateActualSamples(): number {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }

    // Calculate available space for ECG data
    const availableBytes = this.buffer.length - this.header.offsetEcgBlock;
    // Each sample uses 2 bytes and we need to divide by the number of leads
    const actualSamples = Math.floor(availableBytes / (2 * this.header.nLeads));
    
    return actualSamples;
  }

  public parseEcgData(): number[][] {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }

    const { offsetEcgBlock, nLeads } = this.header;
    
    // Use the actual number of samples based on the file size
    const samplesPerLead = this.calculateActualSamples();
    
    // Initialize arrays for each lead
    const ecgData: number[][] = Array.from({ length: nLeads }, () => 
      new Array(samplesPerLead)
    );

    try {
      // Read multiplexed ECG samples
      for (let sample = 0; sample < samplesPerLead; sample++) {
        for (let lead = 0; lead < nLeads; lead++) {
          const offset = offsetEcgBlock + ((sample * nLeads + lead) * 2);
          ecgData[lead][sample] = this.dataView.getInt16(offset, true);
        }
      }

      // If the actual number of samples differs from the header, show a warning
      if (samplesPerLead !== this.header.sampleSizeEcg) {
        console.warn(
          `Warning: Actual number of samples (${samplesPerLead}) ` +
          `differs from header metadata (${this.header.sampleSizeEcg})`
        );
      }

    } catch (error) {
      console.error("Error parsing ECG data:");
      console.error(`Buffer length: ${this.buffer.length}`);
      console.error(`ECG block offset: ${offsetEcgBlock}`);
      console.error(`Actual samples per lead: ${samplesPerLead}`);
      console.error(`Header samples per lead: ${this.header.sampleSizeEcg}`);
      console.error(`Number of leads: ${nLeads}`);
      throw error;
    }

    return ecgData;
  }

  public getEcgSummary(): Record<string, unknown> {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }

    const actualSamples = this.calculateActualSamples();

    return {
      numberOfLeads: this.header.nLeads,
      declaredSamplesPerLead: this.header.sampleSizeEcg,
      actualSamplesPerLead: actualSamples,
      samplingRate: this.header.samplingRate,
      declaredDurationSeconds: this.header.sampleSizeEcg / this.header.samplingRate,
      actualDurationSeconds: actualSamples / this.header.samplingRate,
      dataBlockOffset: this.header.offsetEcgBlock,
      bytesPerSample: 2,
      declaredDataBytes: this.header.sampleSizeEcg * this.header.nLeads * 2,
      actualDataBytes: this.buffer.length - this.header.offsetEcgBlock,
      resolution: this.header.resolution.slice(0, this.header.nLeads)
    };
  }

  public getDebugInfo(): Record<string, unknown> {
    return {
      bufferLength: this.buffer.length,
      magicNumber: this.readString(0, 8),
      checksum: this.dataView.getUint16(8, true),
      header: this.header,
    };
  }

  private async writeStreamToFile(filePath: string, content: AsyncIterable<string>) {
    const file = await Deno.open(filePath, { write: true, create: true, truncate: true });
    const writer = file.writable.getWriter();
    const encoder = new TextEncoder();
  
    try {
      for await (const chunk of content) {
        await writer.write(encoder.encode(chunk));
      }
    } finally {
      writer.close();
      file.close();
    }
  }
  
  private async* generateJsonContent(options: ExportOptions = {}): AsyncGenerator<string> {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }
  
    const {
      timeColumn = true,
      decimalPlaces = 2
    } = options;
  
    const ecgData = this.parseEcgData();
    const samplingRate = this.header.samplingRate;
  
    // Start JSON structure
    yield '{\n  "metadata": ';
    
    // Write metadata
    const metadata = {
      patientInfo: {
        id: this.header.subjectId,
        firstName: this.header.firstName,
        lastName: this.header.lastName,
        sex: this.header.sex,
        race: this.header.race,
        birthDate: this.header.birthDate,
      },
      recordInfo: {
        date: this.header.recordDate,
        startTime: this.header.startTime,
        samplingRate: this.header.samplingRate,
        numberOfLeads: this.header.nLeads,
        leadResolutions: this.header.resolution.slice(0, this.header.nLeads),
        duration: ecgData[0].length / samplingRate,
      },
      technical: {
        fileVersion: this.header.fileVersion,
        pacemaker: this.header.pacemaker,
        recorder: this.header.recorder,
      }
    };
  
    yield JSON.stringify(metadata, null, 2);
    yield ',\n  "data": {\n';
  
    // Write time array if requested
    if (timeColumn) {
      yield '    "time": [\n';
      for (let i = 0; i < ecgData[0].length; i++) {
        yield `      ${Number((i / samplingRate).toFixed(decimalPlaces))}${i < ecgData[0].length - 1 ? ',' : ''}\n`;
      }
      yield '    ],\n';
    }
  
    // Write leads data
    yield '    "leads": [\n';
    for (let lead = 0; lead < this.header.nLeads; lead++) {
      yield '      [\n';
      for (let i = 0; i < ecgData[lead].length; i++) {
        const value = Number((ecgData[lead][i] * this.header.resolution[lead] / 1000000).toFixed(decimalPlaces));
        yield `        ${value}${i < ecgData[lead].length - 1 ? ',' : ''}\n`;
      }
      yield `      ]${lead < this.header.nLeads - 1 ? ',' : ''}\n`;
    }
    yield '    ]\n  }\n}';
  }
  
  private async* generateCsvContent(options: ExportOptions = {}): AsyncGenerator<string> {
    if (!this.header) {
      throw new Error("Header must be parsed first");
    }
  
    const {
      separator = ',',
      includeHeader = true,
      timeColumn = true,
      decimalPlaces = 2
    } = options;
  
    const ecgData = this.parseEcgData();
    const samplingRate = this.header.samplingRate;
  
    // Write header
    if (includeHeader) {
      const headers = [];
      if (timeColumn) headers.push('Time(s)');
      for (let i = 0; i < this.header.nLeads; i++) {
        headers.push(`Lead${i + 1}(mV)`);
      }
      yield headers.join(separator) + '\n';
    }
  
    // Write data rows
    for (let i = 0; i < ecgData[0].length; i++) {
      const row = [];
      if (timeColumn) {
        row.push((i / samplingRate).toFixed(decimalPlaces));
      }
      
      for (let lead = 0; lead < this.header.nLeads; lead++) {
        const value = (ecgData[lead][i] * this.header.resolution[lead] / 1000000).toFixed(decimalPlaces);
        row.push(value);
      }
      yield row.join(separator) + '\n';
    }
  }
  
  public async exportToJson(filePath: string, options: ExportOptions = {}): Promise<void> {
    await this.writeStreamToFile(filePath, this.generateJsonContent(options));
  }
  
  public async exportToCsv(filePath: string, options: ExportOptions = {}): Promise<void> {
    await this.writeStreamToFile(filePath, this.generateCsvContent(options));
  }
  
  public async exportToText(filePath: string, options: ExportOptions = {}): Promise<void> {
    await this.exportToCsv(filePath, { ...options, separator: '\t' });
  }
}