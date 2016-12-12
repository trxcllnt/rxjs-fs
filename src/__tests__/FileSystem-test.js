import path from 'path';
import FileSystem from '../FileSystem';
import { Observable, Scheduler } from 'rxjs';

const dirName = `${__dirname}/test-files`;
const filePath = `${dirName}/test-file`;
const fileContents = 'test-contents';

describe('FileSystem', () => {
    it('should wrap the static Observable methods', () => {
        for (const staticObservableMethod in Observable) {
            expect(FileSystem.hasOwnProperty(staticObservableMethod)).toBe(true);
        }
    });
    it('should create the test files directory', () => {
        return FileSystem
            .mkdir(dirName, () => ({ path: dirName }))
            .stats()
            .do(({ path, stats }) => {
                expect(path).toBe(dirName);
                expect(stats.isDirectory()).toBe(true);
            })
            .last()
            .toPromise();
    });
    it('should create a file in the test files directory', () => {
        return FileSystem
            .writeFile(
                `${filePath}-0`,
                `${fileContents}-0`,
                () => ({ path: `${filePath}-0` })
            )
            .file()
            .do(({ path, file, stats }) => {
                expect(path).toBe(`${filePath}-0`);
                expect(stats.isFile()).toBe(true);
                expect(file.toString()).toBe(`${fileContents}-0`);
            })
            .toPromise();
    });
    it('should remove a file in the test files directory', () => {
        return FileSystem
            .unlink(`${filePath}-0`, () => `${filePath}-0`)
            .mergeMap(
                (unlinkedFilePath) => FileSystem.exists(unlinkedFilePath, (x) => !!x),
                (unlinkedFilePath, exists) => ({ unlinkedFilePath, exists })
            )
            .do(({ unlinkedFilePath, exists }) => {
                expect(exists).toBe(false);
                expect(unlinkedFilePath).toBe(`${filePath}-0`);
            })
            .toPromise();
    });
    it('should remove the test files directory', () => {
        return FileSystem
            .rmdir(dirName, () => dirName)
            .mergeMap(
                (removedDirName) => FileSystem.exists(removedDirName, (x) => !!x),
                (removedDirName, exists) => ({ removedDirName, exists })
            )
            .do(({ removedDirName, exists }) => {
                expect(exists).toBe(false);
                expect(removedDirName).toBe(dirName);
            })
            .toPromise();
    });
});
