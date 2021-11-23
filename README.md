# pod-sticker

**pod-sticker** add `stickyness` to your **pods** by:
- keeping a list of active pods matching `POD_NAME_SELECTOR` by watching kubernetes events
- creating and keeping a list of **sessions** based on `HEADER_NAME` (in the future this could be maintained externally in an external distributed key/value store like `redis`) 
- forward the requests to the pods based on the **session**

## Configuration

```
SET HEADER_NAME=x-auth-request-user
SET POD_NAME_SELECTOR=stateful-dpl
```


