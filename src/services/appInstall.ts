import { db, type AppMetadata } from '../db';
import { parseAppPackage } from './installer';

type InstallOverrides = {
  appIdentifier?: string;
  title?: string;
  icon?: string;
  version?: string;
};

type PrepareInstallOptions = {
  source: string;
  overrides?: InstallOverrides;
};

type CommitInstallOptions = {
  existingApps: AppMetadata[];
  confirmReplace: (nextApp: AppMetadata, currentApp: AppMetadata) => Promise<boolean>;
  onReplace?: (app: AppMetadata) => Promise<void>;
};

export type PreparedInstall = Awaited<ReturnType<typeof parseAppPackage>>;

export async function prepareInstall(file: File, options: PrepareInstallOptions) {
  return parseAppPackage(file, {
    metadataOverrides: {
      installSource: options.source,
      ...options.overrides
    }
  });
}

export async function commitInstall(
  prepared: PreparedInstall,
  options: CommitInstallOptions
) {
  const { app, files } = prepared;
  const existingById = options.existingApps.find(existing => existing.id === app.id);
  if (existingById) {
    return existingById;
  }

  let appToSave = { ...app };
  const existingByIdentifier = app.appIdentifier
    ? options.existingApps.find(existing => existing.appIdentifier === app.appIdentifier)
    : undefined;

  if (existingByIdentifier) {
    const confirmed = await options.confirmReplace(appToSave, existingByIdentifier);
    if (!confirmed) {
      throw new Error('User cancelled installation');
    }

    await options.onReplace?.(existingByIdentifier);
    appToSave.order = existingByIdentifier.order;
  }

  if (appToSave.order === undefined) {
    const maxOrder = options.existingApps.reduce((max, item) => Math.max(max, item.order || 0), 0);
    appToSave.order = maxOrder + 1;
  }

  appToSave = {
    ...appToSave,
    isNew: true
  };

  await db.saveAppBundle(appToSave, files);
  return appToSave;
}
