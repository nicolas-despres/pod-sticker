---
title: Pod Sticker
--- 

# pod-sticker

## Why Pod-Sticker?
The [12 factors methodology](https://12factor.net/) and most of modern cloud architecture best practices rely on application being stateless:
> Sticky sessions are a violation of twelve-factor and should never be used or relied upon

That is a fair statement and I can understand the rational behind it but sometimes this is simply something we cannot change. Also stickyness and sessions can bring a lot of value in term of performance. How can we bring **stickynes** into a container based deployment such as kubernetes?

**pod-sticker** add `stickyness` to your **pods** by:
- keeping a list of active pods matching `POD_NAME_SELECTOR` by watching kubernetes events
- creating and keeping a list of **sessions** based on a cookie
- forwarding the requests to the pods 

```mermaid
graph LR;

 client([client])-. Ingress-managed <br> load balancer .->ingress[Ingress];
 
 ingress-->|/route|service[proxy];

 
 subgraph cluster
   ingress;
   service-->|cookie|pod1[Pod];
   service-->|cookie|pod2[Pod];
   
 end
 
 classDef plain fill:#ddd,stroke:#fff,stroke-width:4px,color:#000;
 classDef k8s fill:#326ce5,stroke:#fff,stroke-width:4px,color:#fff;
 classDef cluster fill:#fff,stroke:#bbb,stroke-width:2px,color:#326ce5;
 class ingress,service,pod1,pod2 k8s;
 class client plain;
 class cluster cluster;
 
```

## Configuration

```
#required: the pod name selector
SET POD_NAME_SELECTOR=stateful-dpl
#optional: the cookie name to use
SET COOKIE_NAME=affinity-stateful
```

## Roadmap

It should be more elegant to create a custom kubernete resource to handle this.
