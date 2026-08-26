import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import { UpdateSettingDto } from './dto/update-setting.dto';

const ALLOWED_TYPES = new Set(['string', 'json', 'number', 'boolean']);

// Keys that must be present and non-empty
const REQUIRED_KEYS = new Set([
  'courier',
  'site_name',
  'site_description',
  'contact_phone',
  'ig_link',
  'tr_link',
  'fb_link',
  'addr_id',
  'addr_province',
  'addr',
  'tax_rate',
  'currency',
  'email',
  'payment_type',
  'maint_mode',
]);

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, any>();

  constructor(private readonly repo: SettingsRepository) {}

  findAll() {
    return this.repo.findAll();
  }

  findByKey(key: string) {
    return this.repo.findByKey(key);
  }

  get(key: string, defaultValue?: any) {
    if (this.cache.has(key)) return this.cache.get(key);
    const alt = this.getAlternateKey(key);
    if (alt && this.cache.has(alt)) return this.cache.get(alt);
    return defaultValue;
  }

  getAll() {
    return Object.fromEntries(this.cache.entries());
  }

  async onModuleInit() {
    try {
      const items = await this.repo.findAll();
      for (const it of items) {
        const parsed = this.parseValue(it.type, it.value);
        this.cache.set(it.key, parsed);
        const alt = this.getAlternateKey(it.key);
        if (alt && !this.cache.has(alt)) this.cache.set(alt, parsed);
      }
      this.logger.log(`Loaded ${items.length} settings into cache`);
    } catch (err: any) {
      this.logger.error('Failed to load settings on init', err?.message ?? err);
    }
  }

  async refreshCache() {
    try {
      const items = await this.repo.findAll();
      this.cache.clear();
      for (const it of items) {
        const parsed = this.parseValue(it.type, it.value);
        this.cache.set(it.key, parsed);
        const alt = this.getAlternateKey(it.key);
        if (alt && !this.cache.has(alt)) this.cache.set(alt, parsed);
      }
      this.logger.log(`Refreshed settings cache with ${items.length} items`);
    } catch (err: any) {
      this.logger.error(
        'Failed to refresh settings cache',
        err?.message ?? err,
      );
    }
  }

  private isEmptyValueForType(value: string, type: string) {
    if (type === 'json') {
      try {
        const parsed = JSON.parse(value);
        if (parsed === null) return true;
        if (typeof parsed === 'object') return Object.keys(parsed).length === 0;
        if (typeof parsed === 'string') return parsed.trim().length === 0;
      } catch (e) {
        return true;
      }
      return false;
    }
    return value == null || String(value).trim().length === 0;
  }

  private sanitizeString(v: string) {
    if (v == null) return '';
    // trim, remove control chars, escape angle brackets
    const trimmed = String(v)
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '');
    return trimmed.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private sanitizeJsonString(v: string) {
    try {
      const parsed = JSON.parse(v);
      const sanitizeRec = (obj: any): any => {
        if (obj == null) return obj;
        if (typeof obj === 'string') return this.sanitizeString(obj);
        if (Array.isArray(obj)) return obj.map(sanitizeRec);
        if (typeof obj === 'object') {
          const out: any = {};
          for (const k of Object.keys(obj)) out[k] = sanitizeRec(obj[k]);
          return out;
        }
        return obj;
      };
      return JSON.stringify(sanitizeRec(parsed));
    } catch (e) {
      throw new BadRequestException('Invalid JSON payload');
    }
  }

  private validateAndSanitize(key: string, dto: UpdateSettingDto) {
    // Determine target type: prefer provided dto.type, else existing setting type
    const providedType = dto.type?.toLowerCase();

    if (providedType && !ALLOWED_TYPES.has(providedType)) {
      throw new BadRequestException(`Unsupported type: ${dto.type}`);
    }

    return this.repo.findByKey(key).then((existing) => {
      const type = providedType ?? existing?.type ?? 'string';

      if (!ALLOWED_TYPES.has(type))
        throw new BadRequestException(`Unsupported type: ${type}`);

      let sanitizedValue: string;

      if (type === 'string') {
        sanitizedValue = this.sanitizeString(dto.value);
        // If email-like key, simple email check
        if (key.includes('email') && sanitizedValue.length > 0) {
          const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
          if (!emailRe.test(sanitizedValue))
            throw new BadRequestException('Invalid email address');
        }
      } else if (type === 'json') {
        sanitizedValue = this.sanitizeJsonString(dto.value);
      } else if (type === 'number') {
        const n = Number(dto.value);
        if (!Number.isFinite(n))
          throw new BadRequestException('Invalid number value');
        sanitizedValue = String(n);
      } else if (type === 'boolean') {
        const v = String(dto.value).toLowerCase();
        if (v === 'true' || v === '1' || v === 'yes') sanitizedValue = 'true';
        else if (v === 'false' || v === '0' || v === 'no')
          sanitizedValue = 'false';
        else throw new BadRequestException('Invalid boolean value');
      } else {
        throw new BadRequestException('Unsupported type');
      }

      // Required keys cannot be empty (accept snake_case or dot-style)
      const canonicalKey = this.canonicalizeKey(key);
      if (REQUIRED_KEYS.has(key) || REQUIRED_KEYS.has(canonicalKey)) {
        if (this.isEmptyValueForType(sanitizedValue, type)) {
          throw new BadRequestException(
            `${key} is required and cannot be empty`,
          );
        }
      }

      const out: UpdateSettingDto = {
        value: sanitizedValue,
      } as any;
      if (dto.type) out.type = dto.type;
      if (dto.description)
        out.description = this.sanitizeString(dto.description);
      return out;
    });
  }

  async upsertByKey(key: string, dto: UpdateSettingDto) {
    const cleaned = await this.validateAndSanitize(key, dto);
    const result = await this.repo.upsertByKey(
      key,
      cleaned as UpdateSettingDto,
    );
    // update cache with parsed value
    try {
      const parsed = this.parseValue(result.type, result.value);
      this.cache.set(result.key, parsed);
      const alt = this.getAlternateKey(result.key);
      if (alt) this.cache.set(alt, parsed);
      // refresh full cache to ensure consistency with DB
      await this.refreshCache();
    } catch (e) {
      this.logger.warn(
        `Failed to parse setting ${result.key} into cache: ${e}`,
      );
    }
    return result;
  }

  private parseValue(type: string, raw: string) {
    const t = (type || 'string').toLowerCase();
    if (t === 'json') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    if (t === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    if (t === 'boolean') {
      const v = String(raw).toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return String(raw);
  }

  private canonicalizeKey(key: string) {
    return String(key).replace(/_/g, '.');
  }

  private getAlternateKey(key: string) {
    if (!key) return null;
    if (key.includes('.')) return key.replace(/\./g, '_');
    if (key.includes('_')) return key.replace(/_/g, '.');
    return null;
  }
}
