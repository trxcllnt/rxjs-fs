import fsModule from 'fs';
import pathModule from 'path';
import { Observable } from 'rxjs';
import $$observable from 'symbol-observable';
import { isScheduler } from 'rxjs/util/isScheduler';

class FileSystem extends Observable {
    constructor(source) {
        if (!source || typeof source === 'function' || typeof source !== 'object') {
            super(source);
        } else if (typeof source[$$observable] === 'function') {
            super();
            this.source = source[$$observable]();
        }
    }
    lift(operator) {
        const observable = new FileSystem(this);
        observable.operator = operator;
        return observable;
    }
    /**
    * Asynchronously emits the contents of a directory.
    * @returns FileSystem<{ String path }>
    **/
    static dir(path = './', options) {
        return FileSystem.of({ path }).dir(options);
    }
    /**
    * Asynchronously emits the contents of a directory and all subdirectories.
    * @returns FileSystem<{ String path }>
    **/
    static expandDir(path = './', options) {
        return FileSystem
            .of({ path })
            .expand(({ path }) => FileSystem
                .dir(path, options));
    }
    /**
    * @returns FileSystem<String path, fs.Stats stats>
    **/
    stats() {
        return this.mergeMap(
            ({ path, stats }) => !stats &&
                FileSystem.stat(path) ||
                FileSystem.of(stats),
            ({ path, ...rest }, stats) => ({
                path, ...rest, stats
            })
        );
    }
    /**
    * @returns FileSystem<String path, fs.Stats fstats>
    **/
    fstats() {
        return this.mergeMap(
            ({ path, fstats }) => !fstats &&
                FileSystem.fstat(path) ||
                FileSystem.of(fstats),
            ({ path, ...rest }, fstats) => ({
                path, ...rest, fstats
            })
        );
    }
    /**
    * @returns FileSystem<String path, fs.Stats fstats>
    **/
    lstats() {
        return this.mergeMap(
            ({ path, lstats }) => !lstats &&
                FileSystem.lstat(path) ||
                FileSystem.of(lstats),
            ({ path, ...rest }, lstats) => ({
                path, ...rest, lstats
            })
        );
    }
    /**
    * @returns FileSystem<String path>
    **/
    dir(options) {
        return this
            .isDirectory()
            .mergeMap(({ path }) => FileSystem.readdir(path, options))
            .mergeMap(
                (paths) => paths,
                (paths, path) => ({ path })
            );
    }
    file(options) {
        return this
            .isFile()
            .mergeMap(
                ({ path }) => FileSystem.readFile(path, options),
                ({ path, ...rest }, file) => ({
                    path, ...rest, file
                })
            );
    }
    isExt(ext) {
        return this.stats().isFile().filter(({ path }) =>
            pathModule.extname(path) === ext
        );
    }
    isFile() {
        return this.stats().filter(({ stats }) => stats.isFile());
    }
    isFIFO() {
        return this.stats().filter(({ stats }) => stats.isFIFO());
    }
    isSocket() {
        return this.stats().filter(({ stats }) => stats.isSocket());
    }
    isDirectory() {
        return this.stats().filter(({ stats }) => stats.isDirectory());
    }
    isBlockDevice() {
        return this.stats().filter(({ stats }) => stats.isBlockDevice());
    }
    isSymbolicLink() {
        return this.lstats().filter(({ lstats }) => lstats.isSymbolicLink());
    }
    isCharacterDevice() {
        return this.stats().filter(({ stats }) => stats.isCharacterDevice());
    }
}

FileSystem = wrapObservableMethods(FileSystem, Observable);
FileSystem = wrapFSModuleMethods(FileSystem, fsModule);

export { FileSystem };
export default FileSystem;

function wrapObservableMethods(FileSystem, Observable) {
    function createStaticWrapper(staticMethodName) {
        return function(...args) {
            return new FileSystem(Observable[staticMethodName](...args));
        }
    }
    for (const staticMethodName in Observable) {
        FileSystem[staticMethodName] = createStaticWrapper(staticMethodName);
    }
    FileSystem.bindCallback = (...args) => (...args2) => new FileSystem(Observable.bindCallback(...args)(...args2));
    FileSystem.bindNodeCallback = (...args) => (...args2) => new FileSystem(Observable.bindNodeCallback(...args)(...args2));
    return FileSystem;
}

function wrapFSModuleMethods(FileSystem, fsModule) {
    function createFSWrapper(fsMethod) {
        function wrappedFSMethod(...args) {
            function wrappedFSMethodDefer() {
                const { args, toObservable } = wrappedFSMethodDefer;
                return toObservable(...args);
            }

            const scheduler = isScheduler(args[args.length - 1]) ? args.pop() : undefined;
            const projection = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;

            wrappedFSMethodDefer.args = args;
            wrappedFSMethodDefer.toObservable = FileSystem.bindNodeCallback(
                wrappedFSMethod.fsMethod, projection, scheduler
            );

            return FileSystem.defer(wrappedFSMethodDefer);
        }

        wrappedFSMethod.fsMethod = fsMethod;

        return wrappedFSMethod;
    }

    return ([
        'access', 'appendFile', 'chmod', 'chown', 'close', 'exists', 'fchmod',
        'fchown', 'fdatasync', 'fstat', 'fsync', 'ftruncate', 'futimes', 'lchmod',
        'lchown', 'link', 'lstat', 'mkdir', 'mkdtemp', 'open', 'read', 'readdir',
        'readFile', 'readlink', 'realpath', 'rename', 'rmdir', 'stat', 'symlink',
        'truncate', 'unlink', 'utimes', 'write', 'writeFile'
    ].reduce((FileSystem, fsMethodName) => {
        FileSystem[fsMethodName] = createFSWrapper(fsModule[fsMethodName]);
        return FileSystem;
    }, FileSystem));
}
